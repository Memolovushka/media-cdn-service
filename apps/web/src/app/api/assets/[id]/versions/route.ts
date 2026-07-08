import {
  createReplacementVersionIntent,
  WorkspaceQuotaExceededError,
} from "@/server/assets";
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

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return jsonError("Invalid JSON body", HTTP_STATUS.badRequest);
  }

  const { id: assetId } = await context.params;

  try {
    const intent = await createReplacementVersionIntent({
      assetId,
      db: ctx.db,
      user,
      input: {
        mimeType: String(body.mimeType ?? ""),
        sizeBytes: Number(body.sizeBytes),
      },
    });

    if (!intent) {
      return notFound();
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
    if (error instanceof WorkspaceQuotaExceededError) {
      return jsonError(error.message, HTTP_STATUS.payloadTooLarge);
    }

    return jsonError(
      error instanceof Error ? error.message : "Replace failed",
      HTTP_STATUS.badRequest
    );
  }
};
