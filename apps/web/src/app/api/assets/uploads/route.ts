import { createUploadIntent, listWorkspaceAssets } from "@/server/assets";
import { getSessionUser } from "@/server/auth";
import { getAppContext } from "@/server/context";
import { forbidden, HTTP_STATUS, jsonError, unauthorized } from "@/server/http";

export const GET = async (request: Request) => {
  const ctx = await getAppContext();
  const user = await getSessionUser(ctx, request);

  if (!user) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");

  if (!workspaceId) {
    return jsonError("workspaceId is required", HTTP_STATUS.badRequest);
  }

  const assets = await listWorkspaceAssets({
    db: ctx.db,
    workspaceId,
    userId: user.id,
  });

  if (!assets) {
    return forbidden();
  }

  return Response.json({ assets });
};

export const POST = async (request: Request) => {
  const ctx = await getAppContext();
  const user = await getSessionUser(ctx, request);

  if (!user) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return jsonError("Invalid JSON body", HTTP_STATUS.badRequest);
  }

  try {
    const intent = await createUploadIntent({
      db: ctx.db,
      user,
      input: {
        workspaceId: String(body.workspaceId ?? ""),
        filename: String(body.filename ?? ""),
        mimeType: String(body.mimeType ?? ""),
        sizeBytes: Number(body.sizeBytes),
        cdnEnabled: Boolean(body.cdnEnabled ?? false),
      },
    });

    if (!intent) {
      return forbidden();
    }

    return Response.json(
      {
        ...intent,
        upload: {
          method: "PUT",
          url: `/api/assets/${intent.assetId}/content?versionId=${intent.versionId}`,
        },
      },
      { status: HTTP_STATUS.created }
    );
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Upload failed",
      HTTP_STATUS.badRequest
    );
  }
};
