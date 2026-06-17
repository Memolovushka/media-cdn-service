import type { AppContext } from "./context";

export const getSession = (ctx: AppContext, request: Request) =>
  ctx.auth.api.getSession({
    headers: request.headers,
  });

export const getSessionUser = async (ctx: AppContext, request: Request) => {
  const session = await getSession(ctx, request);

  return session?.user ?? null;
};
