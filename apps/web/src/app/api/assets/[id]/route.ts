import { eq } from "drizzle-orm";
import { assets, assetTags, assetVersions, auditEvents } from "@/db/schema";
import {
  canPublishToCdn,
  getWritableAsset,
  makePublicAssetUrl,
  makePublicR2Key,
  publicAssetCacheControl,
  sanitizeFilename,
} from "@/server/assets";
import { getSessionUser } from "@/server/auth";
import { type AppContext, getAppContext } from "@/server/context";
import { HTTP_STATUS, jsonError, notFound, unauthorized } from "@/server/http";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

type Asset = typeof assets.$inferSelect;
type AssetVersion = typeof assetVersions.$inferSelect;

interface AssetPatch {
  cdnEnabled?: boolean;
  filename?: string;
  tags?: string[];
}

interface PublishResult {
  currentVersion: AssetVersion;
  publicKey: string;
  publicUrl: string;
}

class AssetPatchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const parseBooleanPatch = (
  body: Record<string, unknown>,
  field: string
): boolean | undefined => {
  if (!(field in body)) {
    return;
  }

  if (typeof body[field] !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }

  return body[field];
};

const maxTags = 20;
const maxTagLength = 40;

const normalizeTag = (tag: string) =>
  tag.trim().toLowerCase().replace(/\s+/g, "-").slice(0, maxTagLength);

const parseTagsPatch = (body: Record<string, unknown>) => {
  if (!("tags" in body)) {
    return;
  }

  if (!Array.isArray(body.tags)) {
    throw new AssetPatchError("tags must be an array", HTTP_STATUS.badRequest);
  }

  const tags = [
    ...new Set(
      body.tags
        .map((tag) => (typeof tag === "string" ? normalizeTag(tag) : ""))
        .filter(Boolean)
    ),
  ];

  if (tags.length > maxTags) {
    throw new AssetPatchError(
      `tags must contain at most ${maxTags} items`,
      HTTP_STATUS.badRequest
    );
  }

  return tags;
};

const parseAssetPatch = (body: Record<string, unknown>): AssetPatch => {
  const cdnEnabled = parseBooleanPatch(body, "cdnEnabled");
  const filename =
    typeof body.filename === "string"
      ? sanitizeFilename(body.filename)
      : undefined;
  const tags = parseTagsPatch(body);

  if (filename !== undefined && !filename) {
    throw new AssetPatchError(
      "filename must not be empty",
      HTTP_STATUS.badRequest
    );
  }

  if (
    cdnEnabled === undefined &&
    filename === undefined &&
    tags === undefined
  ) {
    throw new AssetPatchError(
      "No supported fields to update",
      HTTP_STATUS.badRequest
    );
  }

  return { cdnEnabled, filename, tags };
};

const getAuditEventType = (cdnEnabled: boolean | undefined) => {
  if (cdnEnabled === undefined) {
    return "asset.updated";
  }

  return cdnEnabled ? "asset.cdn_enabled" : "asset.cdn_disabled";
};

const publishReadyVersion = async ({
  asset,
  ctx,
  filename,
  now,
}: {
  asset: Asset;
  ctx: AppContext;
  filename: string;
  now: Date;
}): Promise<PublishResult> => {
  if (!canPublishToCdn(asset.mimeType)) {
    throw new AssetPatchError(
      "This MIME type cannot be published to CDN yet",
      HTTP_STATUS.badRequest
    );
  }

  if (!asset.currentVersionId) {
    throw new AssetPatchError(
      "Asset has no ready version",
      HTTP_STATUS.conflict
    );
  }

  const currentVersion = await ctx.db.query.assetVersions.findFirst({
    where: eq(assetVersions.id, asset.currentVersionId),
  });

  if (!currentVersion || currentVersion.uploadStatus !== "ready") {
    throw new AssetPatchError(
      "Asset has no ready version",
      HTTP_STATUS.conflict
    );
  }

  const sourceObject = await ctx.env.MEDIA_BUCKET.get(currentVersion.r2Key);

  if (!sourceObject) {
    throw new AssetPatchError(
      "Private source object was not found",
      HTTP_STATUS.conflict
    );
  }

  const publicKey = makePublicR2Key({
    workspaceId: asset.workspaceId,
    assetId: asset.id,
    version: currentVersion.version,
    filename,
  });
  const publicUrl = makePublicAssetUrl({
    baseUrl: ctx.env.PUBLIC_MEDIA_BASE_URL,
    workspaceId: asset.workspaceId,
    assetId: asset.id,
    version: currentVersion.version,
    filename,
  });

  await ctx.env.MEDIA_BUCKET.put(publicKey, sourceObject.body, {
    httpMetadata: {
      contentType: asset.mimeType,
      cacheControl: publicAssetCacheControl,
    },
    customMetadata: {
      assetId: asset.id,
      versionId: currentVersion.id,
      checksumSha256: currentVersion.contentHash ?? "",
    },
  });

  await ctx.db
    .update(assetVersions)
    .set({
      publicKey,
      publicUrl,
      cacheControl: publicAssetCacheControl,
      updatedAt: now,
    })
    .where(eq(assetVersions.id, currentVersion.id));

  return { currentVersion, publicKey, publicUrl };
};

const readPatchBody = async (request: Request) => {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    throw new AssetPatchError("Invalid JSON body", HTTP_STATUS.badRequest);
  }

  return body;
};

const requireWritableAsset = async ({
  assetId,
  ctx,
  userId,
}: {
  assetId: string;
  ctx: AppContext;
  userId: string;
}) => {
  const asset = await getWritableAsset({
    db: ctx.db,
    assetId,
    userId,
  });

  if (!asset) {
    throw new AssetPatchError("Not found", HTTP_STATUS.notFound);
  }

  return asset;
};

const buildAssetUpdates = ({
  asset,
  now,
  patch,
}: {
  asset: Asset;
  now: Date;
  patch: AssetPatch;
}): Partial<typeof assets.$inferInsert> => {
  const assetUpdates: Partial<typeof assets.$inferInsert> = { updatedAt: now };

  if (patch.filename !== undefined && patch.filename !== asset.filename) {
    assetUpdates.filename = patch.filename;
  }

  if (patch.cdnEnabled !== undefined) {
    assetUpdates.cdnEnabled = patch.cdnEnabled;
  }

  return assetUpdates;
};

const publishForPatch = ({
  asset,
  ctx,
  filename,
  now,
  patch,
}: {
  asset: Asset;
  ctx: AppContext;
  filename: string;
  now: Date;
  patch: AssetPatch;
}) => {
  if (patch.cdnEnabled !== true) {
    return null;
  }

  return publishReadyVersion({
    asset,
    ctx,
    filename,
    now,
  });
};

const updateTagsForPatch = async ({
  assetId,
  ctx,
  tags,
}: {
  assetId: string;
  ctx: AppContext;
  tags?: string[];
}) => {
  if (tags === undefined) {
    return;
  }

  await ctx.db.delete(assetTags).where(eq(assetTags.assetId, assetId));

  if (tags.length === 0) {
    return;
  }

  await ctx.db.insert(assetTags).values(
    tags.map((tag) => ({
      id: crypto.randomUUID(),
      assetId,
      tag,
    }))
  );
};

const updateAsset = async ({
  assetId,
  ctx,
  request,
  userId,
}: {
  assetId: string;
  ctx: AppContext;
  request: Request;
  userId: string;
}) => {
  const body = await readPatchBody(request);
  const patch = parseAssetPatch(body);
  const asset = await requireWritableAsset({ assetId, ctx, userId });
  const now = new Date();
  const nextFilename = patch.filename ?? asset.filename;
  const assetUpdates = buildAssetUpdates({ asset, now, patch });
  const publishResult = await publishForPatch({
    asset,
    ctx,
    filename: nextFilename,
    now,
    patch,
  });

  await ctx.db.update(assets).set(assetUpdates).where(eq(assets.id, asset.id));
  await updateTagsForPatch({ assetId: asset.id, ctx, tags: patch.tags });

  await ctx.db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId: asset.workspaceId,
    actorUserId: userId,
    assetId: asset.id,
    eventType: getAuditEventType(patch.cdnEnabled),
    metadataJson: JSON.stringify({
      filename: patch.filename === undefined ? undefined : nextFilename,
      publicKey: publishResult?.publicKey,
      publicUrl: publishResult?.publicUrl,
      tags: patch.tags,
      versionId: publishResult?.currentVersion.id,
    }),
  });

  return Response.json({
    asset: {
      ...asset,
      ...assetUpdates,
      filename: nextFilename,
      cdnEnabled: patch.cdnEnabled ?? asset.cdnEnabled,
    },
    publicKey: publishResult?.publicKey ?? null,
    publicUrl: publishResult?.publicUrl ?? null,
    tags: patch.tags,
  });
};

export const PATCH = async (request: Request, context: RouteContext) => {
  const ctx = await getAppContext();
  const user = await getSessionUser(ctx, request);

  if (!user) {
    return unauthorized();
  }

  const { id: assetId } = await context.params;

  try {
    return await updateAsset({
      assetId,
      ctx,
      request,
      userId: user.id,
    });
  } catch (error) {
    if (
      error instanceof AssetPatchError &&
      error.status === HTTP_STATUS.notFound
    ) {
      return notFound();
    }

    return jsonError(
      error instanceof Error ? error.message : "Invalid update",
      error instanceof AssetPatchError ? error.status : HTTP_STATUS.badRequest
    );
  }
};

export const DELETE = async (request: Request, context: RouteContext) => {
  const ctx = await getAppContext();
  const user = await getSessionUser(ctx, request);

  if (!user) {
    return unauthorized();
  }

  const { id: assetId } = await context.params;
  const asset = await getWritableAsset({
    db: ctx.db,
    assetId,
    userId: user.id,
  });

  if (!asset) {
    return notFound();
  }

  const now = new Date();

  await ctx.db
    .update(assets)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(assets.id, asset.id));

  await ctx.db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId: asset.workspaceId,
    actorUserId: user.id,
    assetId: asset.id,
    eventType: "asset.deleted",
    metadataJson: JSON.stringify({ filename: asset.filename }),
  });

  return Response.json({ asset: { id: asset.id } });
};
