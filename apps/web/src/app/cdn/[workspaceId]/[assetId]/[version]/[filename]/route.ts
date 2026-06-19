import { and, eq, isNull } from "drizzle-orm";
import { assets, assetVersions } from "@/db/schema";
import { getAppContext } from "@/server/context";
import { HTTP_STATUS, jsonError, notFound } from "@/server/http";

interface RouteContext {
  params: Promise<{
    assetId: string;
    filename: string;
    version: string;
    workspaceId: string;
  }>;
}

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};
const versionPrefixPattern = /^v/;

const parseVersion = (version: string) => {
  const parsed = Number.parseInt(version.replace(versionPrefixPattern, ""), 10);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const getPublicObject = async (context: RouteContext) => {
  const ctx = await getAppContext();
  const { assetId, version, workspaceId } = await context.params;
  const parsedVersion = parseVersion(version);

  if (!parsedVersion) {
    return jsonError("Invalid CDN version", HTTP_STATUS.badRequest);
  }

  const asset = await ctx.db.query.assets.findFirst({
    where: and(
      eq(assets.id, assetId),
      eq(assets.workspaceId, workspaceId),
      eq(assets.cdnEnabled, true),
      isNull(assets.deletedAt)
    ),
  });

  if (!asset) {
    return notFound();
  }

  const publicVersion = await ctx.db.query.assetVersions.findFirst({
    where: and(
      eq(assetVersions.assetId, asset.id),
      eq(assetVersions.version, parsedVersion),
      eq(assetVersions.uploadStatus, "ready")
    ),
  });

  if (!(publicVersion?.publicKey && publicVersion.publicUrl)) {
    return notFound();
  }

  const object = await ctx.env.MEDIA_BUCKET.get(publicVersion.publicKey);

  if (!object) {
    return notFound();
  }

  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      "Cache-Control":
        publicVersion.cacheControl ?? "public, max-age=31536000, immutable",
      "Content-Length": String(object.size),
      "Content-Type": asset.mimeType,
      ETag: object.etag,
    },
  });
};

export const GET = async (_request: Request, context: RouteContext) =>
  getPublicObject(context);

export const HEAD = async (_request: Request, context: RouteContext) => {
  const response = await getPublicObject(context);

  return new Response(null, {
    headers: response.headers,
    status: response.status,
  });
};

export const OPTIONS = () =>
  new Response(null, {
    headers: corsHeaders,
  });
