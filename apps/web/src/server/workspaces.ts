import { and, count, eq, like } from "drizzle-orm";
import type { Db } from "@/db/client";
import { auditEvents, workspaceMembers, workspaces } from "@/db/schema";
import { getBillingPlan } from "@/server/billing";
import type { AuthUser } from "./assets";

const maxWorkspaceNameLength = 80;
const maxSlugBaseLength = 48;

export const normalizeWorkspaceName = (name: string) => {
  const trimmed = name.trim().replace(/\s+/g, " ");

  if (!trimmed) {
    throw new Error("Workspace name is required");
  }

  return trimmed.slice(0, maxWorkspaceNameLength);
};

export const slugifyWorkspaceName = (name: string) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxSlugBaseLength);

  return slug || "workspace";
};

export const createWorkspaceForUser = async ({
  db,
  name,
  user,
}: {
  db: Db;
  name: string;
  user: AuthUser;
}) => {
  const workspaceName = normalizeWorkspaceName(name);
  const [billing, workspaceCountResult] = await Promise.all([
    getBillingPlan({ db, userId: user.id }),
    db
      .select({ value: count() })
      .from(workspaces)
      .where(eq(workspaces.ownerId, user.id)),
  ]);
  const ownedWorkspaceCount = workspaceCountResult.at(0)?.value ?? 0;

  if (ownedWorkspaceCount >= billing.workspaceLimit) {
    throw new Error(
      `Your current plan allows ${billing.workspaceLimit} workspace${
        billing.workspaceLimit === 1 ? "" : "s"
      }. Upgrade billing to create more.`
    );
  }

  const slugBase = slugifyWorkspaceName(workspaceName);
  const existing = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(like(workspaces.slug, `${slugBase}%`));
  const usedSlugs = new Set(existing.map((workspace) => workspace.slug));
  let slug = slugBase;
  let suffix = 2;

  while (usedSlugs.has(slug)) {
    slug = `${slugBase}-${suffix}`;
    suffix += 1;
  }

  const workspaceId = crypto.randomUUID();

  await db.insert(workspaces).values({
    id: workspaceId,
    name: workspaceName,
    slug,
    ownerId: user.id,
  });

  await db.insert(workspaceMembers).values({
    id: crypto.randomUUID(),
    workspaceId,
    userId: user.id,
    role: "owner",
  });

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId,
    actorUserId: user.id,
    eventType: "workspace.created",
    metadataJson: JSON.stringify({ name: workspaceName, slug }),
  });

  return {
    id: workspaceId,
    name: workspaceName,
    slug,
  };
};

export const renameWorkspaceForUser = async ({
  db,
  name,
  user,
  workspaceId,
}: {
  db: Db;
  name: string;
  user: AuthUser;
  workspaceId: string;
}) => {
  const workspaceName = normalizeWorkspaceName(name);
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (!(membership?.role === "owner" || membership?.role === "admin")) {
    return null;
  }

  const now = new Date();

  await db
    .update(workspaces)
    .set({
      name: workspaceName,
      updatedAt: now,
    })
    .where(eq(workspaces.id, workspaceId));

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    workspaceId,
    actorUserId: user.id,
    eventType: "workspace.renamed",
    metadataJson: JSON.stringify({ name: workspaceName }),
  });

  return {
    id: workspaceId,
    name: workspaceName,
  };
};
