import { eq } from "drizzle-orm";
import { assets, assetVersions, auditEvents } from "@/db/schema";
import { getWritableAssetVersion } from "@/server/assets";
import { getSessionUser } from "@/server/auth";
import { getAppContext } from "@/server/context";
import { HTTP_STATUS, jsonError, notFound, unauthorized } from "@/server/http";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export const POST = async (request: Request, context: RouteContext) => {
  const ctx = await getAppContext();
  const user = await getSessionUser(ctx, request);

  if (!user) {
    return unauthorized();
  }

  const { id: assetId } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const versionId = String(body?.versionId ?? "");

  if (!versionId) {
    return jsonError("versionId is required", HTTP_STATUS.badRequest);
  }

  const record = await getWritableAssetVersion({
    db: ctx.db,
    assetId,
    versionId,
    userId: user.id,
  });

  if (!record) {
    return notFound();
  }

  if (record.version.uploadStatus !== "uploaded") {
    return jsonError("Version has not been uploaded", HTTP_STATUS.conflict);
  }

  const object = await ctx.env.MEDIA_BUCKET.head(record.version.r2Key);

  if (!object) {
    return jsonError("Uploaded object was not found", HTTP_STATUS.conflict);
  }

  const readyAt = new Date();

  await ctx.db
    .update(assetVersions)
    .set({
      uploadStatus: "ready",
      readyAt,
      sizeBytes: object.size,
    })
    .where(eq(assetVersions.id, record.version.id));

  await ctx.db
    .update(assets)
    .set({
      currentVersionId: record.version.id,
      checksumSha256: record.version.contentHash,
      sizeBytes: object.size,
      updatedAt: readyAt,
    })
    .where(eq(assets.id, record.asset.id));

  await ctx.db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId: record.asset.workspaceId,
    actorUserId: user.id,
    assetId: record.asset.id,
    eventType: "asset.upload_completed",
    metadataJson: JSON.stringify({ versionId: record.version.id }),
  });

  return Response.json({
    assetId: record.asset.id,
    versionId: record.version.id,
    version: {
      ...record.version,
      readyAt,
      sizeBytes: object.size,
      uploadStatus: "ready",
    },
    status: "ready",
  });
};
