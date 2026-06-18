import { getSessionUser } from "@/server/auth";
import { getAppContext } from "@/server/context";
import { HTTP_STATUS, jsonError, unauthorized } from "@/server/http";
import { createWorkspaceForUser } from "@/server/workspaces";

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
    const workspace = await createWorkspaceForUser({
      db: ctx.db,
      user,
      name: String(body.name ?? ""),
    });

    return Response.json({ workspace }, { status: HTTP_STATUS.created });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Workspace creation failed",
      HTTP_STATUS.badRequest
    );
  }
};
