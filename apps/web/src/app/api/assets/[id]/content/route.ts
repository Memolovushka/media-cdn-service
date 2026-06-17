import { eq } from "drizzle-orm";
import { assetVersions } from "@/db/schema";
import { getWritableAssetVersion, sha256Hex } from "@/server/assets";
import { getSessionUser } from "@/server/auth";
import { getAppContext } from "@/server/context";
import { HTTP_STATUS, jsonError, notFound, unauthorized } from "@/server/http";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export const PUT = async (request: Request, context: RouteContext) => {
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

  const record = await getWritableAssetVersion({
    db: ctx.db,
    assetId,
    versionId,
    userId: user.id,
  });

  if (!record) {
    return notFound();
  }

  if (record.version.uploadStatus !== "pending") {
    return jsonError("Version is not awaiting upload", HTTP_STATUS.conflict);
  }

  const bytes = await request.arrayBuffer();

  if (bytes.byteLength !== record.asset.sizeBytes) {
    return jsonError(
      "Uploaded size does not match intent",
      HTTP_STATUS.badRequest
    );
  }

  const checksum = await sha256Hex(bytes);

  await ctx.env.MEDIA_BUCKET.put(record.version.r2Key, bytes, {
    httpMetadata: {
      contentType: record.asset.mimeType,
      cacheControl: "private, no-store",
    },
    customMetadata: {
      assetId: record.asset.id,
      versionId: record.version.id,
      checksumSha256: checksum,
    },
  });

  await ctx.db
    .update(assetVersions)
    .set({
      contentHash: checksum,
      sizeBytes: bytes.byteLength,
      uploadStatus: "uploaded",
    })
    .where(eq(assetVersions.id, record.version.id));

  return Response.json({
    assetId: record.asset.id,
    versionId: record.version.id,
    checksumSha256: checksum,
    sizeBytes: bytes.byteLength,
  });
};
