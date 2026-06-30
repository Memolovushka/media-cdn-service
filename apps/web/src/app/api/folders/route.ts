import {
  createWorkspaceFolder,
  deleteWorkspaceFolder,
  listWorkspaceFolders,
  moveWorkspaceFolder,
} from "@/server/assets";
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

  const folders = await listWorkspaceFolders({
    db: ctx.db,
    workspaceId,
    userId: user.id,
  });

  if (!folders) {
    return forbidden();
  }

  return Response.json({ folders });
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
    const folder = await createWorkspaceFolder({
      db: ctx.db,
      workspaceId: String(body.workspaceId ?? ""),
      parentPath: String(body.parentPath ?? ""),
      name: String(body.name ?? ""),
      userId: user.id,
    });

    if (!folder) {
      return forbidden();
    }

    return Response.json({ folder }, { status: HTTP_STATUS.created });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Folder creation failed",
      HTTP_STATUS.badRequest
    );
  }
};

export const PATCH = async (request: Request) => {
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
    const folder = await moveWorkspaceFolder({
      db: ctx.db,
      workspaceId: String(body.workspaceId ?? ""),
      path: String(body.path ?? ""),
      targetParentPath: String(body.targetParentPath ?? ""),
      userId: user.id,
    });

    if (!folder) {
      return forbidden();
    }

    return Response.json({ folder });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Folder move failed",
      HTTP_STATUS.badRequest
    );
  }
};

export const DELETE = async (request: Request) => {
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
    const folder = await deleteWorkspaceFolder({
      db: ctx.db,
      workspaceId: String(body.workspaceId ?? ""),
      path: String(body.path ?? ""),
      userId: user.id,
    });

    if (!folder) {
      return forbidden();
    }

    return Response.json({ folder });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Folder deletion failed",
      HTTP_STATUS.badRequest
    );
  }
};
