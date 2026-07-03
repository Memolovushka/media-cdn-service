import { dash } from "@better-auth/infra";
import {
  type CheckoutOptions,
  checkout,
  type PortalConfig,
  polar,
  portal,
  type WebhooksOptions,
  webhooks,
} from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import type { AppCloudflareEnv } from "@/cloudflare-env";
import { createDb } from "@/db/client";
import { schema } from "@/db/schema";
import {
  getBillingPlanFromProductId,
  getBillingProductConfig,
  setUserBillingPlan,
} from "@/server/billing";

type AuthEnv = Pick<
  AppCloudflareEnv,
  | "BETTER_AUTH_API_KEY"
  | "BETTER_AUTH_SECRET"
  | "BETTER_AUTH_URL"
  | "DB"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "POLAR_ACCESS_TOKEN"
  | "POLAR_PRODUCT_PRO_ID"
  | "POLAR_PRODUCT_TEAM_ID"
  | "POLAR_SERVER"
  | "POLAR_WEBHOOK_SECRET"
>;

const secondsPerMinute = 60;
const minutesPerHour = 60;
const hoursPerDay = 24;
const sessionDays = 30;
const sessionExpiresInSeconds =
  secondsPerMinute * minutesPerHour * hoursPerDay * sessionDays;
const sessionUpdateAgeSeconds = secondsPerMinute * minutesPerHour * hoursPerDay;

const getRecordValue = (value: unknown, key: string): undefined | unknown =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : undefined;

const getNestedString = (value: unknown, path: string[]): null | string => {
  let current: unknown = value;

  for (const key of path) {
    current = getRecordValue(current, key);
  }

  return typeof current === "string" && current ? current : null;
};

const getNestedDate = (value: unknown, path: string[]) => {
  const dateValue = getNestedString(value, path);

  return dateValue ? new Date(dateValue) : null;
};

export const createAuth = (env: AuthEnv) => {
  const hasGoogleCredentials = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  );
  const db = createDb(env.DB);
  const billingProducts = getBillingProductConfig({
    proProductId: env.POLAR_PRODUCT_PRO_ID,
    teamProductId: env.POLAR_PRODUCT_TEAM_ID,
  });
  let polarPlugin: ReturnType<typeof polar> | undefined;

  if (env.POLAR_ACCESS_TOKEN) {
    const polarClient = new Polar({
      accessToken: env.POLAR_ACCESS_TOKEN,
      server: env.POLAR_SERVER ?? "sandbox",
    });
    const polarFeatures: [
      ReturnType<typeof checkout> | ReturnType<typeof portal>,
      ...Array<
        | ReturnType<typeof checkout>
        | ReturnType<typeof portal>
        | ReturnType<typeof webhooks>
      >,
    ] = [portal({ returnUrl: env.BETTER_AUTH_URL } satisfies PortalConfig)];

    if (billingProducts.length) {
      polarFeatures.unshift(
        checkout({
          authenticatedUsersOnly: true,
          products: billingProducts.map((product) => ({
            productId: product.productId,
            slug: product.slug,
          })),
          returnUrl: env.BETTER_AUTH_URL,
          successUrl: "/?billing=success",
        } satisfies CheckoutOptions)
      );
    }

    if (env.POLAR_WEBHOOK_SECRET) {
      polarFeatures.push(
        webhooks({
          secret: env.POLAR_WEBHOOK_SECRET,
          onSubscriptionActive: async (payload) => {
            const productId =
              getNestedString(payload, ["data", "productId"]) ??
              getNestedString(payload, ["data", "product", "id"]);
            const userId =
              getNestedString(payload, ["data", "customer", "externalId"]) ??
              getNestedString(payload, ["data", "metadata", "userId"]);

            if (!userId) {
              return;
            }

            await setUserBillingPlan({
              billingStatus: "active",
              currentPeriodEnd: getNestedDate(payload, [
                "data",
                "currentPeriodEnd",
              ]),
              db,
              plan: getBillingPlanFromProductId({
                productId,
                products: billingProducts,
              }),
              polarCustomerId: getNestedString(payload, ["data", "customerId"]),
              polarProductId: productId,
              polarSubscriptionId: getNestedString(payload, ["data", "id"]),
              userId,
            });
          },
          onSubscriptionCanceled: async (payload) => {
            const userId =
              getNestedString(payload, ["data", "customer", "externalId"]) ??
              getNestedString(payload, ["data", "metadata", "userId"]);

            if (!userId) {
              return;
            }

            await setUserBillingPlan({
              billingStatus: "canceled",
              db,
              plan: "free",
              polarCustomerId: getNestedString(payload, ["data", "customerId"]),
              polarSubscriptionId: getNestedString(payload, ["data", "id"]),
              userId,
            });
          },
          onSubscriptionRevoked: async (payload) => {
            const userId =
              getNestedString(payload, ["data", "customer", "externalId"]) ??
              getNestedString(payload, ["data", "metadata", "userId"]);

            if (!userId) {
              return;
            }

            await setUserBillingPlan({
              billingStatus: "revoked",
              db,
              plan: "free",
              polarCustomerId: getNestedString(payload, ["data", "customerId"]),
              polarSubscriptionId: getNestedString(payload, ["data", "id"]),
              userId,
            });
          },
        } satisfies WebhooksOptions)
      );
    }

    polarPlugin = polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: polarFeatures,
    });
  }

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
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
      usePlural: true,
    }),
    plugins: polarPlugin
      ? [polarPlugin, dash({ apiKey: env.BETTER_AUTH_API_KEY }), nextCookies()]
      : [dash({ apiKey: env.BETTER_AUTH_API_KEY }), nextCookies()],
  });
};

export type Auth = ReturnType<typeof createAuth>;
