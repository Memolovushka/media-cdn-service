import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  assets,
  assetTags,
  assetVersions,
  auditEvents,
  workspaceMembers,
} from "@/db/schema";

const bytesPerKilobyte = 1024;
const kilobytesPerMegabyte = 1024;
const maxUploadMegabytes = 250;
const maxFilenameLength = 180;
const hexRadix = 16;
const hexByteLength = 2;
const firstVersion = 1;
const trailingSlashesPattern = /\/+$/;
const maxUploadBytes =
  bytesPerKilobyte * kilobytesPerMegabyte * maxUploadMegabytes;
export const publicAssetCacheControl = "public, max-age=31536000, immutable";

const allowedMimePrefixes = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "text/plain",
];

export interface AuthUser {
  email?: string | null;
  id: string;
  name?: string | null;
}

export interface UploadIntentInput {
  cdnEnabled?: boolean;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  workspaceId: string;
}

export const sanitizeFilename = (filename: string) => {
  const trimmed = filename.trim();

  if (!trimmed) {
    return "asset";
  }

  return trimmed.replace(/[/\\?%*:|"<>]/g, "-").slice(0, maxFilenameLength);
};

export const assertUploadInput = (input: UploadIntentInput) => {
  if (!(input.sizeBytes > 0 && input.sizeBytes <= maxUploadBytes)) {
    throw new Error("File size is outside the allowed range");
  }

  if (
    !allowedMimePrefixes.some((prefix) =>
      prefix.endsWith("/")
        ? input.mimeType.startsWith(prefix)
        : input.mimeType === prefix
    )
  ) {
    throw new Error("MIME type is not allowed");
  }
};

export const getWorkspaceMembership = async ({
  db,
  workspaceId,
  userId,
}: {
  db: Db;
  workspaceId: string;
  userId: string;
}) =>
  db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });

export const canWriteWorkspace = (role: string) =>
  role === "owner" || role === "admin" || role === "member";

export const makePrivateR2Key = ({
  workspaceId,
  assetId,
  version,
  filename,
}: {
  workspaceId: string;
  assetId: string;
  version: number;
  filename: string;
}) =>
  `private/${workspaceId}/${assetId}/v${version}/${sanitizeFilename(filename)}`;

export const makePublicR2Key = ({
  workspaceId,
  assetId,
  version,
  filename,
}: {
  workspaceId: string;
  assetId: string;
  version: number;
  filename: string;
}) => `cdn/${workspaceId}/${assetId}/v${version}/${sanitizeFilename(filename)}`;

export const makePublicAssetUrl = ({
  baseUrl,
  workspaceId,
  assetId,
  version,
  filename,
}: {
  baseUrl: string;
  workspaceId: string;
  assetId: string;
  version: number;
  filename: string;
}) => {
  const normalizedBaseUrl = baseUrl.replace(trailingSlashesPattern, "");
  const safeFilename = encodeURIComponent(sanitizeFilename(filename));

  return `${normalizedBaseUrl}/${encodeURIComponent(workspaceId)}/${encodeURIComponent(assetId)}/v${version}/${safeFilename}`;
};

export const canPublishToCdn = (mimeType: string) =>
  mimeType !== "image/svg+xml";

export const sha256Hex = async (bytes: ArrayBuffer) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(hexRadix).padStart(hexByteLength, "0"))
    .join("");
};

export const createUploadIntent = async ({
  db,
  user,
  input,
}: {
  db: Db;
  user: AuthUser;
  input: UploadIntentInput;
}) => {
  assertUploadInput(input);

  const membership = await getWorkspaceMembership({
    db,
    workspaceId: input.workspaceId,
    userId: user.id,
  });

  if (!(membership && canWriteWorkspace(membership.role))) {
    return null;
  }

  const assetId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const filename = sanitizeFilename(input.filename);
  const version = firstVersion;
  const r2Key = makePrivateR2Key({
    workspaceId: input.workspaceId,
    assetId,
    version,
    filename,
  });

  await db.insert(assets).values({
    id: assetId,
    workspaceId: input.workspaceId,
    ownerId: user.id,
    filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    cdnEnabled: input.cdnEnabled ?? false,
    currentVersionId: versionId,
  });

  await db.insert(assetVersions).values({
    id: versionId,
    assetId,
    version,
    r2Key,
    sizeBytes: input.sizeBytes,
    uploadStatus: "pending",
  });

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    actorUserId: user.id,
    assetId,
    eventType: "asset.upload_intent_created",
    metadataJson: JSON.stringify({ filename, mimeType: input.mimeType }),
  });

  return {
    assetId,
    versionId,
    filename,
    r2Key,
  };
};

export const getWritableAssetVersion = async ({
  db,
  assetId,
  versionId,
  userId,
}: {
  db: Db;
  assetId: string;
  versionId: string;
  userId: string;
}) => {
  const asset = await db.query.assets.findFirst({
    where: and(eq(assets.id, assetId), isNull(assets.deletedAt)),
  });

  if (!asset) {
    return null;
  }

  const membership = await getWorkspaceMembership({
    db,
    workspaceId: asset.workspaceId,
    userId,
  });

  if (!(membership && canWriteWorkspace(membership.role))) {
    return null;
  }

  const version = await db.query.assetVersions.findFirst({
    where: and(
      eq(assetVersions.id, versionId),
      eq(assetVersions.assetId, assetId)
    ),
  });

  if (!version) {
    return null;
  }

  return { asset, version };
};

export const getWritableAsset = async ({
  db,
  assetId,
  userId,
}: {
  db: Db;
  assetId: string;
  userId: string;
}) => {
  const asset = await db.query.assets.findFirst({
    where: and(eq(assets.id, assetId), isNull(assets.deletedAt)),
  });

  if (!asset) {
    return null;
  }

  const membership = await getWorkspaceMembership({
    db,
    workspaceId: asset.workspaceId,
    userId,
  });

  if (!(membership && canWriteWorkspace(membership.role))) {
    return null;
  }

  return asset;
};

export const listWorkspaceAssets = async ({
  db,
  workspaceId,
  userId,
}: {
  db: Db;
  workspaceId: string;
  userId: string;
}) => {
  const membership = await getWorkspaceMembership({ db, workspaceId, userId });

  if (!membership) {
    return null;
  }

  const assetRows = await db.query.assets.findMany({
    where: and(eq(assets.workspaceId, workspaceId), isNull(assets.deletedAt)),
    orderBy: [desc(assets.createdAt)],
  });

  if (assetRows.length === 0) {
    return [];
  }

  const versionRows = await db
    .select()
    .from(assetVersions)
    .where(
      inArray(
        assetVersions.assetId,
        assetRows.map((asset) => asset.id)
      )
    )
    .orderBy(desc(assetVersions.version));
  const latestVersions = new Map<string, (typeof versionRows)[number]>();

  for (const version of versionRows) {
    if (!latestVersions.has(version.assetId)) {
      latestVersions.set(version.assetId, version);
    }
  }

  const tagRows = await db
    .select()
    .from(assetTags)
    .where(
      inArray(
        assetTags.assetId,
        assetRows.map((asset) => asset.id)
      )
    );
  const tagsByAsset = new Map<string, string[]>();

  for (const tag of tagRows) {
    tagsByAsset.set(tag.assetId, [
      ...(tagsByAsset.get(tag.assetId) ?? []),
      tag.tag,
    ]);
  }

  return assetRows.map((asset) => ({
    ...asset,
    tags: tagsByAsset.get(asset.id) ?? [],
    versions: latestVersions.has(asset.id)
      ? [latestVersions.get(asset.id) as (typeof versionRows)[number]]
      : [],
  }));
};
