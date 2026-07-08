import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  like,
  ne,
  sql,
} from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  assetFolders,
  assets,
  assetVersions,
  auditEvents,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { getBillingPlan } from "@/server/billing";

const bytesPerKilobyte = 1024;
const kilobytesPerMegabyte = 1024;
const megabytesPerGigabyte = 1024;
const maxUploadMegabytes = 250;
const maxFilenameLength = 180;
const maxFolderPathLength = 240;
const hexRadix = 16;
const hexByteLength = 2;
const firstVersion = 1;
const trailingSlashesPattern = /\/+$/;
const maxUploadBytes =
  bytesPerKilobyte * kilobytesPerMegabyte * maxUploadMegabytes;
const defaultWorkspaceStorageQuotaBytes =
  bytesPerKilobyte * kilobytesPerMegabyte * megabytesPerGigabyte;
const syntheticFolderIdPrefix = "asset-path";
const maxActivityEvents = 20;
export const publicAssetCacheControl = "public, max-age=31536000, immutable";

const allowedMimePrefixes = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "text/plain",
];

export interface AuthUser {
  email?: string | null;
  id: string;
  name?: string | null;
}

export interface UploadIntentInput {
  cdnEnabled?: boolean;
  filename: string;
  folderPath?: string;
  mimeType: string;
  sizeBytes: number;
  workspaceId: string;
}

export interface ReplaceVersionIntentInput {
  mimeType: string;
  sizeBytes: number;
}

export interface WorkspaceFolderItem {
  createdAt: Date;
  createdByUserId: string | null;
  id: string;
  name: string;
  path: string;
  updatedAt: Date;
  workspaceId: string;
}

export interface WorkspaceStorageUsage {
  cdnCopyCount: number;
  privateBytes: number;
  publicBytes: number;
  quotaBytes: number;
  readyVersionCount: number;
  totalBytes: number;
}

export interface WorkspaceActivityEvent {
  actorEmail: null | string;
  actorName: null | string;
  assetFilename: null | string;
  assetId: null | string;
  createdAt: Date;
  eventType: string;
  id: string;
  metadata: Record<string, unknown>;
}

export class WorkspaceQuotaExceededError extends Error {
  constructor({
    requestedBytes,
    quotaBytes,
    usedBytes,
  }: {
    requestedBytes: number;
    quotaBytes: number;
    usedBytes: number;
  }) {
    super("Account storage quota exceeded");
    this.name = "WorkspaceQuotaExceededError";
    this.requestedBytes = requestedBytes;
    this.quotaBytes = quotaBytes;
    this.usedBytes = usedBytes;
  }

  quotaBytes: number;
  requestedBytes: number;
  usedBytes: number;
}

export const sanitizeFilename = (filename: string) => {
  const trimmed = filename.trim();

  if (!trimmed) {
    return "asset";
  }

  return trimmed.replace(/[/\\?%*:|"<>]/g, "-").slice(0, maxFilenameLength);
};

export const normalizeFolderPath = (path: string) => {
  const normalized = path
    .split("/")
    .map((segment) => sanitizeFilename(segment).trim())
    .filter(Boolean)
    .join("/");

  return normalized.slice(0, maxFolderPathLength);
};

export const assertUploadInput = (input: UploadIntentInput) => {
  if (!(input.sizeBytes > 0 && input.sizeBytes <= maxUploadBytes)) {
    throw new Error("File size is outside the allowed range");
  }

  if (
    !allowedMimePrefixes.some((prefix) =>
      prefix.endsWith("/")
        ? input.mimeType.startsWith(prefix)
        : input.mimeType === prefix
    )
  ) {
    throw new Error("MIME type is not allowed");
  }
};

export const getWorkspaceMembership = async ({
  db,
  workspaceId,
  userId,
}: {
  db: Db;
  workspaceId: string;
  userId: string;
}) =>
  db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });

export const canWriteWorkspace = (role: string) =>
  role === "owner" || role === "admin" || role === "member";

export const listWorkspaceFolders = async ({
  db,
  workspaceId,
  userId,
}: {
  db: Db;
  workspaceId: string;
  userId: string;
}) => {
  const membership = await getWorkspaceMembership({ db, workspaceId, userId });

  if (!membership) {
    return null;
  }

  const folderRows = await db
    .select()
    .from(assetFolders)
    .where(eq(assetFolders.workspaceId, workspaceId))
    .orderBy(asc(assetFolders.path));
  const assetFolderRows = await db
    .select({ folderPath: assets.folderPath })
    .from(assets)
    .where(and(eq(assets.workspaceId, workspaceId), isNull(assets.deletedAt)));
  const foldersByPath = new Map<string, WorkspaceFolderItem>();

  for (const folder of folderRows) {
    foldersByPath.set(folder.path, folder);
  }

  for (const asset of assetFolderRows) {
    const folderPath = normalizeFolderPath(asset.folderPath);

    if (!folderPath) {
      continue;
    }

    const segments = folderPath.split("/");

    for (let index = 0; index < segments.length; index += 1) {
      const path = segments.slice(0, index + 1).join("/");

      if (foldersByPath.has(path)) {
        continue;
      }

      foldersByPath.set(path, {
        id: `${syntheticFolderIdPrefix}:${workspaceId}:${path}`,
        workspaceId,
        path,
        name: segments[index] ?? path,
        createdByUserId: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      });
    }
  }

  return [...foldersByPath.values()].sort((left, right) =>
    left.path.localeCompare(right.path)
  );
};

export const getWorkspaceStorageUsage = async ({
  db,
  workspaceId,
  userId,
}: {
  db: Db;
  workspaceId: string;
  userId: string;
}): Promise<WorkspaceStorageUsage | null> => {
  const membership = await getWorkspaceMembership({ db, workspaceId, userId });

  if (!membership) {
    return null;
  }

  const workspace = await db.query.workspaces.findFirst({
    columns: { ownerId: true },
    where: eq(workspaces.id, workspaceId),
  });
  const billing = workspace
    ? await getBillingPlan({ db, userId: workspace.ownerId })
    : null;
  const objectSize = sql<number>`coalesce(${assetVersions.sizeBytes}, ${assets.sizeBytes}, 0)`;
  const [usage] = await db
    .select({
      cdnCopyCount: sql<number>`coalesce(sum(case when ${assetVersions.publicKey} is not null then 1 else 0 end), 0)`,
      privateBytes: sql<number>`coalesce(sum(${objectSize}), 0)`,
      publicBytes: sql<number>`coalesce(sum(case when ${assetVersions.publicKey} is not null then ${objectSize} else 0 end), 0)`,
      readyVersionCount: sql<number>`count(${assetVersions.id})`,
    })
    .from(assets)
    .innerJoin(workspaces, eq(workspaces.id, assets.workspaceId))
    .innerJoin(assetVersions, eq(assetVersions.assetId, assets.id))
    .where(
      and(
        eq(workspaces.ownerId, workspace?.ownerId ?? ""),
        isNull(assets.deletedAt),
        eq(assetVersions.uploadStatus, "ready")
      )
    );

  const privateBytes = Number(usage?.privateBytes ?? 0);
  const publicBytes = Number(usage?.publicBytes ?? 0);

  return {
    cdnCopyCount: Number(usage?.cdnCopyCount ?? 0),
    privateBytes,
    publicBytes,
    quotaBytes: billing?.storageQuotaBytes ?? defaultWorkspaceStorageQuotaBytes,
    readyVersionCount: Number(usage?.readyVersionCount ?? 0),
    totalBytes: privateBytes + publicBytes,
  };
};

const parseAuditMetadata = (metadataJson: null | string) => {
  if (!metadataJson) {
    return {};
  }

  const parsed = (() => {
    try {
      return JSON.parse(metadataJson) as unknown;
    } catch {
      return null;
    }
  })();

  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
};

export const listWorkspaceActivity = async ({
  db,
  workspaceId,
  userId,
}: {
  db: Db;
  workspaceId: string;
  userId: string;
}): Promise<null | WorkspaceActivityEvent[]> => {
  const membership = await getWorkspaceMembership({ db, workspaceId, userId });

  if (!membership) {
    return null;
  }

  const rows = await db
    .select({
      actorEmail: users.email,
      actorName: users.name,
      assetFilename: assets.filename,
      assetId: auditEvents.assetId,
      createdAt: auditEvents.createdAt,
      eventType: auditEvents.eventType,
      id: auditEvents.id,
      metadataJson: auditEvents.metadataJson,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .leftJoin(assets, eq(assets.id, auditEvents.assetId))
    .where(
      and(
        eq(auditEvents.workspaceId, workspaceId),
        ne(auditEvents.eventType, "asset.previewed")
      )
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(maxActivityEvents);

  return rows.map((event) => ({
    ...event,
    metadata: parseAuditMetadata(event.metadataJson),
  }));
};

const getAccountReservedStorageBytes = async ({
  db,
  ownerId,
}: {
  db: Db;
  ownerId: string;
}) => {
  const [usage] = await db
    .select({
      totalBytes: sql<number>`coalesce(sum(${assets.sizeBytes}), 0)`,
    })
    .from(assets)
    .innerJoin(workspaces, eq(workspaces.id, assets.workspaceId))
    .where(and(eq(workspaces.ownerId, ownerId), isNull(assets.deletedAt)));

  return Number(usage?.totalBytes ?? 0);
};

export const createWorkspaceFolder = async ({
  db,
  name,
  parentPath,
  userId,
  workspaceId,
}: {
  db: Db;
  name: string;
  parentPath?: string;
  userId: string;
  workspaceId: string;
}) => {
  const membership = await getWorkspaceMembership({ db, workspaceId, userId });

  if (!(membership && canWriteWorkspace(membership.role))) {
    return null;
  }

  const safeName = normalizeFolderPath(name);

  if (!safeName || safeName.includes("/")) {
    throw new Error("Folder name must be a single non-empty path segment");
  }

  const normalizedParentPath = normalizeFolderPath(parentPath ?? "");
  const path = normalizeFolderPath(
    normalizedParentPath ? `${normalizedParentPath}/${safeName}` : safeName
  );
  const now = new Date();

  await db
    .insert(assetFolders)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      path,
      name: safeName,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId,
    actorUserId: userId,
    eventType: "folder.created",
    metadataJson: JSON.stringify({ path }),
  });

  return { path, name: safeName };
};

export const deleteWorkspaceFolder = async ({
  db,
  path,
  userId,
  workspaceId,
}: {
  db: Db;
  path: string;
  userId: string;
  workspaceId: string;
}) => {
  const membership = await getWorkspaceMembership({ db, workspaceId, userId });

  if (!(membership && canWriteWorkspace(membership.role))) {
    return null;
  }

  const normalizedPath = normalizeFolderPath(path);

  if (!normalizedPath) {
    throw new Error("Folder path is required");
  }

  const folder = await db.query.assetFolders.findFirst({
    where: and(
      eq(assetFolders.workspaceId, workspaceId),
      eq(assetFolders.path, normalizedPath)
    ),
  });

  const assetInFolder = await db.query.assets.findFirst({
    where: and(
      eq(assets.workspaceId, workspaceId),
      eq(assets.folderPath, normalizedPath),
      isNull(assets.deletedAt)
    ),
  });
  const childAssetInFolder = assetInFolder
    ? null
    : await db.query.assets.findFirst({
        where: and(
          eq(assets.workspaceId, workspaceId),
          like(assets.folderPath, `${normalizedPath}/%`),
          isNull(assets.deletedAt)
        ),
      });

  if (!(folder || assetInFolder || childAssetInFolder)) {
    throw new Error("Folder not found");
  }

  const now = new Date();

  await db
    .update(assets)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(assets.workspaceId, workspaceId),
        eq(assets.folderPath, normalizedPath),
        isNull(assets.deletedAt)
      )
    );

  await db
    .update(assets)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(assets.workspaceId, workspaceId),
        like(assets.folderPath, `${normalizedPath}/%`),
        isNull(assets.deletedAt)
      )
    );

  await db
    .delete(assetFolders)
    .where(
      and(
        eq(assetFolders.workspaceId, workspaceId),
        eq(assetFolders.path, normalizedPath)
      )
    );

  await db
    .delete(assetFolders)
    .where(
      and(
        eq(assetFolders.workspaceId, workspaceId),
        like(assetFolders.path, `${normalizedPath}/%`)
      )
    );

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId,
    actorUserId: userId,
    eventType: "folder.deleted",
    metadataJson: JSON.stringify({ path: normalizedPath, recursive: true }),
  });

  return { path: normalizedPath };
};

const rewriteChildFolderPath = ({
  fromPath,
  path,
  toPath,
}: {
  fromPath: string;
  path: string;
  toPath: string;
}) =>
  path === fromPath ? toPath : `${toPath}/${path.slice(fromPath.length + 1)}`;

export const moveWorkspaceFolder = async ({
  db,
  path,
  targetParentPath,
  userId,
  workspaceId,
}: {
  db: Db;
  path: string;
  targetParentPath?: string;
  userId: string;
  workspaceId: string;
}) => {
  const membership = await getWorkspaceMembership({ db, workspaceId, userId });

  if (!(membership && canWriteWorkspace(membership.role))) {
    return null;
  }

  const normalizedPath = normalizeFolderPath(path);
  const normalizedTargetParentPath = normalizeFolderPath(
    targetParentPath ?? ""
  );

  if (!normalizedPath) {
    throw new Error("Folder path is required");
  }

  if (
    normalizedTargetParentPath === normalizedPath ||
    normalizedTargetParentPath.startsWith(`${normalizedPath}/`)
  ) {
    throw new Error("Folder cannot be moved into itself");
  }

  const folderName = normalizedPath.split("/").at(-1) ?? normalizedPath;
  const nextPath = normalizeFolderPath(
    normalizedTargetParentPath
      ? `${normalizedTargetParentPath}/${folderName}`
      : folderName
  );

  if (nextPath === normalizedPath) {
    return { name: folderName, path: normalizedPath };
  }

  const existingTargetFolder = await db.query.assetFolders.findFirst({
    where: and(
      eq(assetFolders.workspaceId, workspaceId),
      eq(assetFolders.path, nextPath)
    ),
  });

  if (existingTargetFolder) {
    throw new Error("Folder already exists at target");
  }

  const folderRows = await db
    .select({ id: assetFolders.id, path: assetFolders.path })
    .from(assetFolders)
    .where(
      and(
        eq(assetFolders.workspaceId, workspaceId),
        like(assetFolders.path, `${normalizedPath}%`)
      )
    );
  const assetRows = await db
    .select({ folderPath: assets.folderPath, id: assets.id })
    .from(assets)
    .where(
      and(
        eq(assets.workspaceId, workspaceId),
        like(assets.folderPath, `${normalizedPath}%`),
        isNull(assets.deletedAt)
      )
    );
  const movableFolderRows = folderRows.filter(
    (folder) =>
      folder.path === normalizedPath ||
      folder.path.startsWith(`${normalizedPath}/`)
  );
  const movableAssetRows = assetRows.filter(
    (asset) =>
      asset.folderPath === normalizedPath ||
      asset.folderPath.startsWith(`${normalizedPath}/`)
  );

  if (!(movableFolderRows.length || movableAssetRows.length)) {
    throw new Error("Folder not found");
  }

  const now = new Date();

  for (const folder of movableFolderRows.sort(
    (left, right) => right.path.length - left.path.length
  )) {
    const rewrittenPath = rewriteChildFolderPath({
      fromPath: normalizedPath,
      path: folder.path,
      toPath: nextPath,
    });

    await db
      .update(assetFolders)
      .set({
        name: rewrittenPath.split("/").at(-1) ?? rewrittenPath,
        path: rewrittenPath,
        updatedAt: now,
      })
      .where(eq(assetFolders.id, folder.id));
  }

  for (const asset of movableAssetRows) {
    await db
      .update(assets)
      .set({
        folderPath: rewriteChildFolderPath({
          fromPath: normalizedPath,
          path: asset.folderPath,
          toPath: nextPath,
        }),
        updatedAt: now,
      })
      .where(eq(assets.id, asset.id));
  }

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId,
    actorUserId: userId,
    eventType: "folder.moved",
    metadataJson: JSON.stringify({
      fromPath: normalizedPath,
      toPath: nextPath,
    }),
  });

  return { name: folderName, path: nextPath };
};

export const makePrivateR2Key = ({
  workspaceId,
  assetId,
  version,
  filename,
}: {
  workspaceId: string;
  assetId: string;
  version: number;
  filename: string;
}) =>
  `private/${workspaceId}/${assetId}/v${version}/${sanitizeFilename(filename)}`;

export const makePublicR2Key = ({
  workspaceId,
  assetId,
  version,
  filename,
}: {
  workspaceId: string;
  assetId: string;
  version: number;
  filename: string;
}) => `cdn/${workspaceId}/${assetId}/v${version}/${sanitizeFilename(filename)}`;

export const makePublicAssetUrl = ({
  baseUrl,
  workspaceId,
  assetId,
  version,
  filename,
}: {
  baseUrl: string;
  workspaceId: string;
  assetId: string;
  version: number;
  filename: string;
}) => {
  const normalizedBaseUrl = baseUrl.replace(trailingSlashesPattern, "");
  const safeFilename = encodeURIComponent(sanitizeFilename(filename));

  return `${normalizedBaseUrl}/${encodeURIComponent(workspaceId)}/${encodeURIComponent(assetId)}/v${version}/${safeFilename}`;
};

export const canPublishToCdn = (mimeType: string) =>
  mimeType !== "image/svg+xml";

export const sha256Hex = async (bytes: ArrayBuffer) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(hexRadix).padStart(hexByteLength, "0"))
    .join("");
};

export const createUploadIntent = async ({
  db,
  user,
  input,
}: {
  db: Db;
  user: AuthUser;
  input: UploadIntentInput;
}) => {
  assertUploadInput(input);

  const membership = await getWorkspaceMembership({
    db,
    workspaceId: input.workspaceId,
    userId: user.id,
  });

  if (!(membership && canWriteWorkspace(membership.role))) {
    return null;
  }

  const workspace = await db.query.workspaces.findFirst({
    columns: { ownerId: true },
    where: eq(workspaces.id, input.workspaceId),
  });
  const billing = workspace
    ? await getBillingPlan({ db, userId: workspace.ownerId })
    : null;
  const quotaBytes =
    billing?.storageQuotaBytes ?? defaultWorkspaceStorageQuotaBytes;
  const usedBytes = await getAccountReservedStorageBytes({
    db,
    ownerId: workspace?.ownerId ?? user.id,
  });

  if (usedBytes + input.sizeBytes > quotaBytes) {
    throw new WorkspaceQuotaExceededError({
      requestedBytes: input.sizeBytes,
      quotaBytes,
      usedBytes,
    });
  }

  const assetId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const filename = sanitizeFilename(input.filename);
  const folderPath = normalizeFolderPath(input.folderPath ?? "");
  const version = firstVersion;
  const r2Key = makePrivateR2Key({
    workspaceId: input.workspaceId,
    assetId,
    version,
    filename,
  });

  await db.insert(assets).values({
    id: assetId,
    workspaceId: input.workspaceId,
    ownerId: user.id,
    filename,
    folderPath,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    cdnEnabled: input.cdnEnabled ?? false,
    currentVersionId: versionId,
  });

  await db.insert(assetVersions).values({
    id: versionId,
    assetId,
    version,
    r2Key,
    sizeBytes: input.sizeBytes,
    uploadStatus: "pending",
  });

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    actorUserId: user.id,
    assetId,
    eventType: "asset.upload_intent_created",
    metadataJson: JSON.stringify({ filename, mimeType: input.mimeType }),
  });

  return {
    assetId,
    versionId,
    filename,
    r2Key,
  };
};

export const createReplacementVersionIntent = async ({
  assetId,
  db,
  input,
  user,
}: {
  assetId: string;
  db: Db;
  input: ReplaceVersionIntentInput;
  user: AuthUser;
}) => {
  if (!(input.sizeBytes > 0 && input.sizeBytes <= maxUploadBytes)) {
    throw new Error("File size is outside the allowed range");
  }

  const asset = await getWritableAsset({
    db,
    assetId,
    userId: user.id,
  });

  if (!asset) {
    return null;
  }

  if (input.mimeType !== asset.mimeType) {
    throw new Error("Replacement file must keep the same MIME type");
  }

  const workspace = await db.query.workspaces.findFirst({
    columns: { ownerId: true },
    where: eq(workspaces.id, asset.workspaceId),
  });
  const billing = workspace
    ? await getBillingPlan({ db, userId: workspace.ownerId })
    : null;
  const quotaBytes =
    billing?.storageQuotaBytes ?? defaultWorkspaceStorageQuotaBytes;
  const usedBytes = await getAccountReservedStorageBytes({
    db,
    ownerId: workspace?.ownerId ?? user.id,
  });

  if (usedBytes + input.sizeBytes > quotaBytes) {
    throw new WorkspaceQuotaExceededError({
      requestedBytes: input.sizeBytes,
      quotaBytes,
      usedBytes,
    });
  }

  const latestVersion = await db.query.assetVersions.findFirst({
    where: eq(assetVersions.assetId, asset.id),
    orderBy: [desc(assetVersions.version)],
  });
  const nextVersion = (latestVersion?.version ?? 0) + 1;
  const versionId = crypto.randomUUID();
  const r2Key = makePrivateR2Key({
    workspaceId: asset.workspaceId,
    assetId: asset.id,
    version: nextVersion,
    filename: asset.filename,
  });

  await db.insert(assetVersions).values({
    id: versionId,
    assetId: asset.id,
    version: nextVersion,
    r2Key,
    sizeBytes: input.sizeBytes,
    uploadStatus: "pending",
  });

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId: asset.workspaceId,
    actorUserId: user.id,
    assetId: asset.id,
    eventType: "asset.version_replace_created",
    metadataJson: JSON.stringify({
      filename: asset.filename,
      version: nextVersion,
      versionId,
    }),
  });

  return {
    assetId: asset.id,
    versionId,
    filename: asset.filename,
    r2Key,
  };
};

export const getWritableAssetVersion = async ({
  db,
  assetId,
  versionId,
  userId,
}: {
  db: Db;
  assetId: string;
  versionId: string;
  userId: string;
}) => {
  const asset = await db.query.assets.findFirst({
    where: and(eq(assets.id, assetId), isNull(assets.deletedAt)),
  });

  if (!asset) {
    return null;
  }

  const membership = await getWorkspaceMembership({
    db,
    workspaceId: asset.workspaceId,
    userId,
  });

  if (!(membership && canWriteWorkspace(membership.role))) {
    return null;
  }

  const version = await db.query.assetVersions.findFirst({
    where: and(
      eq(assetVersions.id, versionId),
      eq(assetVersions.assetId, assetId)
    ),
  });

  if (!version) {
    return null;
  }

  return { asset, version };
};

export const getReadableAssetVersion = async ({
  db,
  assetId,
  versionId,
  userId,
}: {
  db: Db;
  assetId: string;
  versionId: string;
  userId: string;
}) => {
  const asset = await db.query.assets.findFirst({
    where: and(eq(assets.id, assetId), isNull(assets.deletedAt)),
  });

  if (!asset) {
    return null;
  }

  const membership = await getWorkspaceMembership({
    db,
    workspaceId: asset.workspaceId,
    userId,
  });

  if (!membership) {
    return null;
  }

  const version = await db.query.assetVersions.findFirst({
    where: and(
      eq(assetVersions.id, versionId),
      eq(assetVersions.assetId, assetId)
    ),
  });

  if (!version) {
    return null;
  }

  return { asset, version };
};

export const getWritableAsset = async ({
  db,
  assetId,
  userId,
}: {
  db: Db;
  assetId: string;
  userId: string;
}) => {
  const asset = await db.query.assets.findFirst({
    where: and(eq(assets.id, assetId), isNull(assets.deletedAt)),
  });

  if (!asset) {
    return null;
  }

  const membership = await getWorkspaceMembership({
    db,
    workspaceId: asset.workspaceId,
    userId,
  });

  if (!(membership && canWriteWorkspace(membership.role))) {
    return null;
  }

  return asset;
};

export const listWorkspaceAssets = async ({
  db,
  folderPath,
  workspaceId,
  userId,
}: {
  db: Db;
  folderPath?: string;
  workspaceId: string;
  userId: string;
}) => {
  const membership = await getWorkspaceMembership({ db, workspaceId, userId });

  if (!membership) {
    return null;
  }

  const normalizedFolderPath =
    folderPath === undefined ? undefined : normalizeFolderPath(folderPath);
  const assetRows = await db.query.assets.findMany({
    where: and(
      eq(assets.workspaceId, workspaceId),
      normalizedFolderPath === undefined
        ? undefined
        : eq(assets.folderPath, normalizedFolderPath),
      isNull(assets.deletedAt)
    ),
    orderBy: [desc(assets.createdAt)],
  });

  if (assetRows.length === 0) {
    return [];
  }

  const versionRows = await db
    .select()
    .from(assetVersions)
    .where(
      inArray(
        assetVersions.assetId,
        assetRows.map((asset) => asset.id)
      )
    )
    .orderBy(desc(assetVersions.version));
  const versionsByAssetId = new Map<string, (typeof versionRows)[number][]>();

  for (const version of versionRows) {
    const versions = versionsByAssetId.get(version.assetId) ?? [];
    versions.push(version);
    versionsByAssetId.set(version.assetId, versions);
  }

  return assetRows.map((asset) => ({
    ...asset,
    versions: versionsByAssetId.get(asset.id) ?? [],
  }));
};
