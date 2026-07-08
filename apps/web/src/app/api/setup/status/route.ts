import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AppCloudflareEnv } from "@/cloudflare-env";
import { HTTP_STATUS, jsonError } from "@/server/http";

interface TableRow {
  name: string;
}

export const GET = async () => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const appEnv = env as AppCloudflareEnv;
    const hasDbBinding = Boolean(appEnv.DB);
    const hasMediaBucketBinding = Boolean(appEnv.MEDIA_BUCKET);
    const hasGoogleCredentials = Boolean(
      appEnv.GOOGLE_CLIENT_ID && appEnv.GOOGLE_CLIENT_SECRET
    );
    const hasPolarAccessToken = Boolean(appEnv.POLAR_ACCESS_TOKEN);
    const hasPolarProducts = Boolean(
      appEnv.POLAR_PRODUCT_PRO_ID && appEnv.POLAR_PRODUCT_TEAM_ID
    );
    const hasPolarWebhookSecret = Boolean(appEnv.POLAR_WEBHOOK_SECRET);
    const hasPolarCheckout = hasPolarAccessToken && hasPolarProducts;
    const hasPolarConfig = hasPolarCheckout && hasPolarWebhookSecret;

    if (!hasDbBinding) {
      return Response.json({
        ok: false,
        bindings: {
          DB: false,
          MEDIA_BUCKET: hasMediaBucketBinding,
          GOOGLE: hasGoogleCredentials,
          POLAR: hasPolarConfig,
        },
        billing: {
          polarAccessToken: hasPolarAccessToken,
          polarCheckout: hasPolarCheckout,
          polarProducts: hasPolarProducts,
          polarServer: appEnv.POLAR_SERVER ?? "sandbox",
          polarWebhook: hasPolarWebhookSecret,
          ready: hasPolarConfig,
        },
        database: {
          ready: false,
          tables: [],
        },
      });
    }

    const result = await appEnv.DB.prepare(
      "select name from sqlite_master where type = 'table' order by name"
    ).all<TableRow>();
    const tables = result.results.map((row) => row.name);
    const requiredTables = [
      "users",
      "accounts",
      "sessions",
      "workspaces",
      "user_billing",
      "asset_folders",
    ];
    const missingTables = requiredTables.filter(
      (table) => !tables.includes(table)
    );

    return Response.json({
      ok: missingTables.length === 0,
      bindings: {
        DB: true,
        MEDIA_BUCKET: hasMediaBucketBinding,
        GOOGLE: hasGoogleCredentials,
        POLAR: hasPolarConfig,
      },
      billing: {
        polarAccessToken: hasPolarAccessToken,
        polarCheckout: hasPolarCheckout,
        polarProducts: hasPolarProducts,
        polarServer: appEnv.POLAR_SERVER ?? "sandbox",
        polarWebhook: hasPolarWebhookSecret,
        ready: hasPolarConfig,
      },
      database: {
        ready: missingTables.length === 0,
        missingTables,
        tables,
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Runtime status check failed",
      HTTP_STATUS.conflict
    );
  }
};
