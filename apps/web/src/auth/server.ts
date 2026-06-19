import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import type { AppCloudflareEnv } from "@/cloudflare-env";
import { createDb } from "@/db/client";
import { schema } from "@/db/schema";

type AuthEnv = Pick<
  AppCloudflareEnv,
  | "BETTER_AUTH_API_KEY"
  | "BETTER_AUTH_SECRET"
  | "BETTER_AUTH_URL"
  | "DB"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
>;

const secondsPerMinute = 60;
const minutesPerHour = 60;
const hoursPerDay = 24;
const sessionDays = 30;
const sessionExpiresInSeconds =
  secondsPerMinute * minutesPerHour * hoursPerDay * sessionDays;
const sessionUpdateAgeSeconds = secondsPerMinute * minutesPerHour * hoursPerDay;

export const createAuth = (env: AuthEnv) => {
  const hasGoogleCredentials = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  );

  return betterAuth({
    appName: "Media CDN Service",
    basePath: "/api/auth",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    session: {
      expiresIn: sessionExpiresInSeconds,
      updateAge: sessionUpdateAgeSeconds,
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: hasGoogleCredentials
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID as string,
            clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          },
        }
      : undefined,
    database: drizzleAdapter(createDb(env.DB), {
      provider: "sqlite",
      schema,
      usePlural: true,
    }),
    plugins: [dash({ apiKey: env.BETTER_AUTH_API_KEY }), nextCookies()],
  });
};

export type Auth = ReturnType<typeof createAuth>;
