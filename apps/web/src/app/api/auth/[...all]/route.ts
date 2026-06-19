import { getCloudflareContext } from "@opennextjs/cloudflare";
import { toNextJsHandler } from "better-auth/next-js";
import { createAuth } from "@/auth/server";
import type { AppCloudflareEnv } from "@/cloudflare-env";
import { HTTP_STATUS, jsonError } from "@/server/http";

const handler = async (request: Request) => {
  const { env } = await getCloudflareContext({ async: true });
  const appEnv = env as AppCloudflareEnv;

  if (!appEnv.DB) {
    return jsonError(
      "Cloudflare D1 binding DB is missing. Deploy with the DB binding before using auth.",
      HTTP_STATUS.serviceUnavailable
    );
  }

  return createAuth(appEnv).handler(request);
};

export const { GET, POST } = toNextJsHandler(handler);
