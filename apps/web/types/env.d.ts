import type { website } from "../alchemy.run";

type AppCloudflareEnv = typeof website.Env;

declare global {
  interface CloudflareEnv extends AppCloudflareEnv {}
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends AppCloudflareEnv {}
  }
}
