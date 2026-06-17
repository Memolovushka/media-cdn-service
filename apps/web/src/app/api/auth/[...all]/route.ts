import { getCloudflareContext } from "@opennextjs/cloudflare";
import { toNextJsHandler } from "better-auth/next-js";
import { createAuth } from "@/auth/server";
import type { AppCloudflareEnv } from "@/cloudflare-env";

const handler = async (request: Request) => {
  const { env } = await getCloudflareContext({ async: true });
  return createAuth(env as AppCloudflareEnv).handler(request);
};

export const { GET, POST } = toNextJsHandler(handler);
