import { getAppContext } from "@/server/context";
import { HTTP_STATUS, jsonError } from "@/server/http";

interface TableRow {
  name: string;
}

export const GET = async () => {
  try {
    const ctx = await getAppContext();
    const hasDbBinding = Boolean(ctx.env.DB);
    const hasMediaBucketBinding = Boolean(ctx.env.MEDIA_BUCKET);
    const hasGoogleCredentials = Boolean(
      ctx.env.GOOGLE_CLIENT_ID && ctx.env.GOOGLE_CLIENT_SECRET
    );

    if (!hasDbBinding) {
      return Response.json({
        ok: false,
        bindings: {
          DB: false,
          MEDIA_BUCKET: hasMediaBucketBinding,
          GOOGLE: hasGoogleCredentials,
        },
        database: {
          ready: false,
          tables: [],
        },
      });
    }

    const result = await ctx.env.DB.prepare(
      "select name from sqlite_master where type = 'table' order by name"
    ).all<TableRow>();
    const tables = result.results.map((row) => row.name);
    const requiredTables = ["users", "accounts", "sessions", "workspaces"];
    const missingTables = requiredTables.filter(
      (table) => !tables.includes(table)
    );

    return Response.json({
      ok: missingTables.length === 0,
      bindings: {
        DB: true,
        MEDIA_BUCKET: hasMediaBucketBinding,
        GOOGLE: hasGoogleCredentials,
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
