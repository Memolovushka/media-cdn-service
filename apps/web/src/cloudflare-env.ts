export type AppCloudflareEnv = CloudflareEnv & {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  BETTER_AUTH_API_KEY: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  POLAR_ACCESS_TOKEN?: string;
  POLAR_PRODUCT_PRO_ID?: string;
  POLAR_PRODUCT_TEAM_ID?: string;
  POLAR_SERVER?: "production" | "sandbox";
  POLAR_WEBHOOK_SECRET?: string;
  PUBLIC_MEDIA_BASE_URL: string;
};
