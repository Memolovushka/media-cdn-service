import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import type { AppCloudflareEnv } from "@/cloudflare-env";
import { createDb } from "@/db/client";
import { schema } from "@/db/schema";

type AuthEnv = Pick<
  AppCloudflareEnv,
  "BETTER_AUTH_API_KEY" | "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "DB"
>;

export const createAuth = (env: AuthEnv) =>
  betterAuth({
    appName: "Media CDN Service",
    basePath: "/api/auth",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
    },
    database: drizzleAdapter(createDb(env.DB), {
      provider: "sqlite",
      schema,
      usePlural: true,
    }),
    plugins: [dash({ apiKey: env.BETTER_AUTH_API_KEY }), nextCookies()],
  });

export type Auth = ReturnType<typeof createAuth>;
