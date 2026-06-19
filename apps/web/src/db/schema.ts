import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)]
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sessions_token_idx").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
  ]
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)]
);

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspaces_slug_idx").on(table.slug),
    index("workspaces_owner_id_idx").on(table.ownerId),
  ]
);

export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["owner", "admin", "member", "viewer"],
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspace_members_workspace_user_idx").on(
      table.workspaceId,
      table.userId
    ),
    index("workspace_members_user_id_idx").on(table.userId),
  ]
);

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    folderPath: text("folder_path").notNull().default(""),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksumSha256: text("checksum_sha256"),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    cdnEnabled: integer("cdn_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    currentVersionId: text("current_version_id"),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (table) => [
    index("assets_workspace_id_idx").on(table.workspaceId),
    index("assets_workspace_folder_idx").on(
      table.workspaceId,
      table.folderPath
    ),
    index("assets_owner_id_idx").on(table.ownerId),
    index("assets_cdn_enabled_idx").on(table.cdnEnabled),
  ]
);

export const assetFolders = sqliteTable(
  "asset_folders",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    name: text("name").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("asset_folders_workspace_path_idx").on(
      table.workspaceId,
      table.path
    ),
    index("asset_folders_workspace_id_idx").on(table.workspaceId),
  ]
);

export const assetVersions = sqliteTable(
  "asset_versions",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    r2Key: text("r2_key").notNull(),
    publicKey: text("public_key"),
    publicUrl: text("public_url"),
    contentHash: text("content_hash"),
    sizeBytes: integer("size_bytes"),
    uploadStatus: text("upload_status", {
      enum: ["pending", "uploaded", "ready", "failed", "abandoned"],
    })
      .notNull()
      .default("pending"),
    cacheControl: text("cache_control"),
    metadataJson: text("metadata_json"),
    readyAt: integer("ready_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("asset_versions_asset_version_idx").on(
      table.assetId,
      table.version
    ),
    uniqueIndex("asset_versions_r2_key_idx").on(table.r2Key),
    index("asset_versions_asset_id_idx").on(table.assetId),
    index("asset_versions_upload_status_idx").on(table.uploadStatus),
  ]
);

export const assetTags = sqliteTable(
  "asset_tags",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("asset_tags_asset_tag_idx").on(table.assetId, table.tag),
    index("asset_tags_tag_idx").on(table.tag),
  ]
);

export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    tokenHash: text("token_hash").notNull(),
    scopesJson: text("scopes_json").notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("api_tokens_token_hash_idx").on(table.tokenHash),
    index("api_tokens_workspace_id_idx").on(table.workspaceId),
    index("api_tokens_owner_id_idx").on(table.ownerId),
  ]
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assetId: text("asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("audit_events_workspace_id_idx").on(table.workspaceId),
    index("audit_events_asset_id_idx").on(table.assetId),
    index("audit_events_event_type_idx").on(table.eventType),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  ownedWorkspaces: many(workspaces),
  workspaceMemberships: many(workspaceMembers),
}));

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  assets: many(assets),
  folders: many(assetFolders),
  apiTokens: many(apiTokens),
  auditEvents: many(auditEvents),
}));

export const assetsRelations = relations(assets, ({ many, one }) => ({
  workspace: one(workspaces, {
    fields: [assets.workspaceId],
    references: [workspaces.id],
  }),
  owner: one(users, {
    fields: [assets.ownerId],
    references: [users.id],
  }),
  versions: many(assetVersions),
  tags: many(assetTags),
  auditEvents: many(auditEvents),
}));

export const assetFoldersRelations = relations(assetFolders, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [assetFolders.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(users, {
    fields: [assetFolders.createdByUserId],
    references: [users.id],
  }),
}));

export const schema = {
  users,
  sessions,
  accounts,
  verifications,
  workspaces,
  workspaceMembers,
  assets,
  assetFolders,
  assetVersions,
  assetTags,
  apiTokens,
  auditEvents,
};
