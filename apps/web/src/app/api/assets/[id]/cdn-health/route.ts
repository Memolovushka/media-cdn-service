import { eq } from "drizzle-orm";
import { assets } from "@/db/schema";
import {
  getReadableAssetVersion,
  publicAssetCacheControl,
} from "@/server/assets";
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
  const asset = await ctx.db.query.assets.findFirst({
    columns: { currentVersionId: true },
    where: eq(assets.id, assetId),
  });

  if (!asset?.currentVersionId) {
    return notFound();
  }

  const record = await getReadableAssetVersion({
    db: ctx.db,
    assetId,
    versionId: asset.currentVersionId,
    userId: user.id,
  });

  if (!record) {
    return notFound();
  }

  if (!(record.asset.cdnEnabled && record.version.publicKey)) {
    return jsonError("Asset is not published", HTTP_STATUS.conflict);
  }

  const object = await ctx.env.MEDIA_BUCKET.head(record.version.publicKey);
  const cacheControl =
    record.version.cacheControl ?? object?.httpMetadata?.cacheControl ?? null;
  const contentType =
    object?.httpMetadata?.contentType ?? record.asset.mimeType;

  return Response.json({
    checkedAt: new Date().toISOString(),
    ok: Boolean(object),
    cacheControl,
    cacheControlOk: cacheControl === publicAssetCacheControl,
    contentType,
    contentTypeOk: contentType === record.asset.mimeType,
    publicUrl: record.version.publicUrl,
    urlOk: Boolean(record.version.publicUrl && object),
    versionId: record.version.id,
  });
};
