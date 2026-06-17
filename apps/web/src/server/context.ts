import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/auth/server";
import type { AppCloudflareEnv } from "@/cloudflare-env";
import { createDb } from "@/db/client";

export const getAppContext = async () => {
  const { env } = await getCloudflareContext({ async: true });
  const appEnv = env as AppCloudflareEnv;

  return {
    env: appEnv,
    auth: createAuth(appEnv),
    db: createDb(appEnv.DB),
  };
};

export type AppContext = Awaited<ReturnType<typeof getAppContext>>;
