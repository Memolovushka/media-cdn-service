import alchemy from "alchemy";
import { D1Database, Nextjs, R2Bucket } from "alchemy/cloudflare";

const stage = process.env.ALCHEMY_STAGE ?? "dev";
const app = await alchemy("media-cdn-service");

export const database = await D1Database("db", {
  name: `media-cdn-service-${stage}-db`,
  migrationsDir: "./drizzle/migrations",
  migrationsTable: "__drizzle_migrations",
  primaryLocationHint: "weur",
});

export const mediaBucket = await R2Bucket("media", {
  name: `media-cdn-service-${stage}-media`,
  cors: [
    {
      allowed: {
        origins: ["*"],
        methods: ["GET", "HEAD", "PUT", "POST"],
        headers: ["*"],
      },
      exposeHeaders: ["ETag", "Content-Type", "Content-Length"],
      maxAgeSeconds: 3600,
    },
  ],
  lifecycle: [
    {
      id: "abort-incomplete-multipart-uploads",
      enabled: true,
      abortMultipartUploadsTransition: {
        condition: {
          maxAge: 7,
          type: "Age",
        },
      },
    },
  ],
});

export const website = await Nextjs("website", {
  adopt: true,
  bindings: {
    DB: database,
    MEDIA_BUCKET: mediaBucket,
    BETTER_AUTH_API_KEY: alchemy.secret.env("BETTER_AUTH_API_KEY"),
    BETTER_AUTH_SECRET: alchemy.secret.env("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    PUBLIC_MEDIA_BASE_URL:
      process.env.PUBLIC_MEDIA_BASE_URL ?? "http://localhost:3000/cdn",
  },
});

console.log({
  url: website.url,
  database: database.name,
  mediaBucket: mediaBucket.name,
});

await app.finalize();
