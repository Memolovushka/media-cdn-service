import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { userBilling, workspaces } from "@/db/schema";

const bytesPerKilobyte = 1024;
const kilobytesPerMegabyte = 1024;
const megabytesPerGigabyte = 1024;
const proStorageGigabytes = 25;
const teamStorageGigabytes = 100;

export type BillingPlan = "free" | "pro" | "team";
export type BillingStatus =
  | "active"
  | "canceled"
  | "free"
  | "past_due"
  | "revoked";

export interface BillingPlanConfig {
  label: string;
  plan: BillingPlan;
  storageQuotaBytes: number;
  workspaceLimit: number;
}

export interface BillingProductConfig {
  plan: Exclude<BillingPlan, "free">;
  productId: string;
  slug: string;
}

export const billingPlans = {
  free: {
    label: "Free",
    plan: "free",
    storageQuotaBytes:
      bytesPerKilobyte * kilobytesPerMegabyte * megabytesPerGigabyte,
    workspaceLimit: 1,
  },
  pro: {
    label: "Pro",
    plan: "pro",
    storageQuotaBytes:
      bytesPerKilobyte *
      kilobytesPerMegabyte *
      megabytesPerGigabyte *
      proStorageGigabytes,
    workspaceLimit: 5,
  },
  team: {
    label: "Team",
    plan: "team",
    storageQuotaBytes:
      bytesPerKilobyte *
      kilobytesPerMegabyte *
      megabytesPerGigabyte *
      teamStorageGigabytes,
    workspaceLimit: 20,
  },
} satisfies Record<BillingPlan, BillingPlanConfig>;

export const getBillingProductConfig = ({
  proProductId,
  teamProductId,
}: {
  proProductId?: string;
  teamProductId?: string;
}) =>
  [
    proProductId
      ? ({
          plan: "pro",
          productId: proProductId,
          slug: "pro",
        } satisfies BillingProductConfig)
      : null,
    teamProductId
      ? ({
          plan: "team",
          productId: teamProductId,
          slug: "team",
        } satisfies BillingProductConfig)
      : null,
  ].filter((product): product is BillingProductConfig => Boolean(product));

export const getBillingPlanFromProductId = ({
  productId,
  products,
}: {
  productId?: null | string;
  products: BillingProductConfig[];
}): BillingPlan => {
  const product = products.find(
    (candidate) => candidate.productId === productId
  );

  return product?.plan ?? "free";
};

export const getBillingPlan = async ({
  db,
  userId,
}: {
  db: Db;
  userId: string;
}) => {
  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, userId),
  });
  const plan = billing?.plan ?? "free";
  const limits = billingPlans[plan];

  return {
    billingStatus: billing?.billingStatus ?? "free",
    currentPeriodEnd: billing?.currentPeriodEnd ?? null,
    plan,
    polarProductId: billing?.polarProductId ?? null,
    polarSubscriptionId: billing?.polarSubscriptionId ?? null,
    storageQuotaBytes: billing?.storageQuotaBytes ?? limits.storageQuotaBytes,
    workspaceLimit: billing?.workspaceLimit ?? limits.workspaceLimit,
  };
};

export const setUserBillingPlan = async ({
  billingStatus,
  currentPeriodEnd,
  db,
  plan,
  polarCustomerId,
  polarProductId,
  polarSubscriptionId,
  userId,
}: {
  billingStatus: BillingStatus;
  currentPeriodEnd?: Date | null;
  db: Db;
  plan: BillingPlan;
  polarCustomerId?: null | string;
  polarProductId?: null | string;
  polarSubscriptionId?: null | string;
  userId: string;
}) => {
  const limits = billingPlans[plan];
  const now = new Date();

  await db
    .insert(userBilling)
    .values({
      userId,
      billingStatus,
      currentPeriodEnd: currentPeriodEnd ?? null,
      plan,
      polarCustomerId: polarCustomerId ?? null,
      polarProductId: polarProductId ?? null,
      polarSubscriptionId: polarSubscriptionId ?? null,
      storageQuotaBytes: limits.storageQuotaBytes,
      workspaceLimit: limits.workspaceLimit,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userBilling.userId,
      set: {
        billingStatus,
        currentPeriodEnd: currentPeriodEnd ?? null,
        plan,
        polarCustomerId: polarCustomerId ?? null,
        polarProductId: polarProductId ?? null,
        polarSubscriptionId: polarSubscriptionId ?? null,
        storageQuotaBytes: limits.storageQuotaBytes,
        updatedAt: now,
        workspaceLimit: limits.workspaceLimit,
      },
    });

  await db
    .update(workspaces)
    .set({
      storageQuotaBytes: limits.storageQuotaBytes,
      updatedAt: now,
    })
    .where(eq(workspaces.ownerId, userId));
};
