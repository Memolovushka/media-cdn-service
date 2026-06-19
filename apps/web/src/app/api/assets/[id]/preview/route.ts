import { auditEvents } from "@/db/schema";
import { getReadableAssetVersion } from "@/server/assets";
import { getSessionUser } from "@/server/auth";
import { getAppContext } from "@/server/context";
import { HTTP_STATUS, jsonError, notFound, unauthorized } from "@/server/http";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export const GET = async (request: Request, context: RouteContext) => {
  const ctx = await getAppContext();
  const user = await getSessionUser(ctx, request);

  if (!user) {
    return unauthorized();
  }

  const { id: assetId } = await context.params;
  const versionId = new URL(request.url).searchParams.get("versionId");

  if (!versionId) {
    return jsonError("versionId is required", HTTP_STATUS.badRequest);
  }

  const record = await getReadableAssetVersion({
    db: ctx.db,
    assetId,
    versionId,
    userId: user.id,
  });

  if (!record) {
    return notFound();
  }

  if (record.version.uploadStatus !== "ready") {
    return jsonError("Version is not ready", HTTP_STATUS.conflict);
  }

  const object = await ctx.env.MEDIA_BUCKET.get(record.version.r2Key);

  if (!object) {
    return notFound();
  }

  await ctx.db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId: record.asset.workspaceId,
    actorUserId: user.id,
    assetId: record.asset.id,
    eventType: "asset.previewed",
    metadataJson: JSON.stringify({ versionId: record.version.id }),
  });

  return new Response(object.body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${record.asset.filename}"`,
      "Content-Length": String(object.size),
      "Content-Type": record.asset.mimeType,
    },
  });
};
