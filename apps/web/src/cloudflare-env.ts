export type AppCloudflareEnv = CloudflareEnv & {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  BETTER_AUTH_API_KEY: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  PUBLIC_MEDIA_BASE_URL: string;
};
