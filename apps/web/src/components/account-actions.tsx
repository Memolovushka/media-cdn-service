"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import {
  CheckIcon,
  CommandIcon,
  KeyRoundIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { authClient } from "@/auth/client";
import {
  type CommandPaletteShortcut,
  commandPaletteShortcutOptions,
  getCommandPaletteShortcutLabel,
  readCommandPaletteShortcut,
  requestCommandPaletteOpen,
  updateCommandPaletteShortcut,
} from "@/components/command-palette-shortcuts";
import { TooltipHint } from "@/components/tooltip-hint";

type BillingPlanName = "free" | "pro" | "team";

interface AccountActionsProps {
  billing: {
    checkoutConfigured: boolean;
    plan: BillingPlanName;
    planLabel: string;
    status: string;
    storageQuotaBytes: number;
    webhookConfigured: boolean;
    workspaceCount: number;
    workspaceLimit: number;
  };
  email?: null | string;
  plans: Array<{
    label: string;
    plan: BillingPlanName;
    storageQuotaBytes: number;
    workspaceLimit: number;
  }>;
  products: Array<{
    label: string;
    slug: string;
  }>;
}

const minPasswordLength = 8;
const bytesPerKilobyte = 1024;
const kilobytesPerMegabyte = 1024;
const megabytesPerGigabyte = 1024;
const bytesPerGigabyte =
  bytesPerKilobyte * kilobytesPerMegabyte * megabytesPerGigabyte;
const planDescriptions = {
  free: "For trying the file manager and publishing flow with one workspace.",
  pro: "For solo operators who need more room, more workspaces, and a real production CDN workflow.",
  team: "For growing projects that need wider workspace capacity and room for more production assets.",
} satisfies Record<BillingPlanName, string>;
const planHighlights = {
  free: [
    "1 workspace",
    "1 GB storage",
    "Uploads, previews, folders, and CDN publishing basics",
  ],
  pro: [
    "5 workspaces",
    "25 GB storage",
    "Version history, replace flow, CDN health checks, and public links",
  ],
  team: [
    "20 workspaces",
    "100 GB storage",
    "More production space for teams, clients, and parallel media projects",
  ],
} satisfies Record<BillingPlanName, string[]>;

const getAuthErrorMessage = (error: unknown) => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Account update failed";
};

const getBillingErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as {
      code?: string;
      error?: string;
      message?: string;
    };

    return (
      payload.message ?? payload.error ?? payload.code ?? response.statusText
    );
  } catch {
    return response.statusText;
  }
};

const formatStorageQuota = (bytes: number) => {
  const gigabytes = bytes / bytesPerGigabyte;

  return `${Number.isInteger(gigabytes) ? gigabytes : gigabytes.toFixed(1)} GB`;
};

const getPlanButtonLabel = ({
  action,
  isCurrent,
  label,
  plan,
}: {
  action: null | string;
  isCurrent: boolean;
  label: string;
  plan: string;
}) => {
  if (action === plan) {
    return "Opening...";
  }

  if (isCurrent) {
    return "Current plan";
  }

  return `Upgrade to ${label}`;
};

const openBillingUrl = async (path: string, body?: Record<string, unknown>) => {
  const response = await fetch(`/api/auth${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : undefined,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await getBillingErrorMessage(response));
  }

  const payload = (await response.json()) as { url?: string };

  if (!payload.url) {
    throw new Error("Billing provider did not return a checkout URL");
  }

  window.location.assign(payload.url);
};

export const AccountActions = ({
  billing,
  email,
  plans,
  products,
}: AccountActionsProps) => {
  const router = useRouter();
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [commandPaletteShortcut, setCommandPaletteShortcut] =
    useState<CommandPaletteShortcut>("mod+k");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [billingAction, setBillingAction] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingDialogOpen, setBillingDialogOpen] = useState(false);

  useEffect(() => {
    setCommandPaletteShortcut(readCommandPaletteShortcut());
  }, []);

  const changeCommandPaletteShortcut = (shortcut: CommandPaletteShortcut) => {
    setCommandPaletteShortcut(shortcut);
    updateCommandPaletteShortcut(shortcut);
  };

  const openCommandPalette = () => {
    setOpen(false);
    window.setTimeout(requestCommandPaletteOpen, 0);
  };

  const openBillingDialog = () => {
    setBillingDialogOpen(true);
    setBillingError(null);
  };

  const changePassword = () => {
    setError(null);
    setSuccess(null);

    if (newPassword.length < minPasswordLength) {
      setError(`New password must be at least ${minPasswordLength} characters`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    startTransition(async () => {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated");
      router.refresh();
    });
  };

  const signOut = () => {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/auth?mode=signin");
      router.refresh();
    });
  };

  const startCheckout = (slug: string) => {
    setBillingAction(slug);
    setBillingError(null);
    startTransition(async () => {
      try {
        await openBillingUrl("/checkout", { redirect: false, slug });
      } catch (checkoutError) {
        setBillingError(
          checkoutError instanceof Error
            ? checkoutError.message
            : "Checkout could not be opened"
        );
        setBillingAction(null);
      }
    });
  };

  const openBillingPortal = () => {
    setBillingAction("portal");
    setBillingError(null);
    startTransition(async () => {
      try {
        await openBillingUrl("/customer/portal", { redirect: false });
      } catch (portalError) {
        setBillingError(
          portalError instanceof Error
            ? portalError.message
            : "Billing portal could not be opened"
        );
        setBillingAction(null);
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Dialog onOpenChange={setBillingDialogOpen} open={billingDialogOpen}>
        <DialogContent className="max-h-[min(720px,calc(100svh-2rem))] overflow-y-auto p-0 sm:max-w-3xl">
          <div className="border-b px-5 py-4">
            <DialogHeader>
              <DialogTitle>Billing</DialogTitle>
              <DialogDescription>
                Your current plan and the upgrade options for more workspace and
                CDN capacity.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 px-5 pb-5">
            <div className="grid gap-3 rounded-md border bg-muted/20 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">
                    Current plan: {billing.planLabel}
                  </span>
                  <Badge variant="outline">{billing.status}</Badge>
                </div>
                <div className="text-muted-foreground text-xs">
                  {billing.workspaceCount} of {billing.workspaceLimit}{" "}
                  workspaces used ·{" "}
                  {formatStorageQuota(billing.storageQuotaBytes)} included
                  storage
                </div>
              </div>
              <Button
                disabled={isPending}
                onClick={openBillingPortal}
                size="sm"
                type="button"
                variant="outline"
              >
                {billingAction === "portal" ? "Opening..." : "Manage billing"}
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {plans.map((plan) => {
                const product = products.find(
                  (candidate) => candidate.slug === plan.plan
                );
                const isCurrent = billing.plan === plan.plan;
                const canCheckout = Boolean(
                  billing.checkoutConfigured && product && !isCurrent
                );

                return (
                  <div
                    className="flex min-h-[18rem] flex-col rounded-md border bg-background p-4"
                    key={plan.plan}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{plan.label}</div>
                        <div className="text-muted-foreground text-xs">
                          {formatStorageQuota(plan.storageQuotaBytes)} ·{" "}
                          {plan.workspaceLimit} workspaces
                        </div>
                      </div>
                      {isCurrent ? (
                        <Badge variant="secondary">Current</Badge>
                      ) : null}
                    </div>
                    <p className="mb-4 text-muted-foreground text-xs">
                      {planDescriptions[plan.plan] ?? planDescriptions.free}
                    </p>
                    <ul className="mb-4 grid gap-2 text-xs">
                      {(planHighlights[plan.plan] ?? []).map((highlight) => (
                        <li className="flex gap-2" key={highlight}>
                          <CheckIcon className="mt-0.5 size-3 shrink-0 text-primary" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto grid gap-2">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <ShieldCheckIcon className="size-3 shrink-0" />
                        Price is confirmed in Polar before payment
                      </div>
                      {plan.plan === "free" ? (
                        <Button
                          disabled
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Included
                        </Button>
                      ) : (
                        <Button
                          disabled={isPending || !canCheckout}
                          onClick={() => startCheckout(plan.plan)}
                          size="sm"
                          type="button"
                          variant={isCurrent ? "secondary" : "default"}
                        >
                          {getPlanButtonLabel({
                            action: billingAction,
                            isCurrent,
                            label: plan.label,
                            plan: plan.plan,
                          })}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {billingError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-xs">
                {billingError}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <Popover onOpenChange={setOpen} open={open}>
        <TooltipProvider>
          <Tooltip>
            <PopoverTrigger asChild>
              <TooltipTrigger asChild>
                <Button size="icon" type="button" variant="outline">
                  <SettingsIcon />
                  <span className="sr-only">Account settings</span>
                </Button>
              </TooltipTrigger>
            </PopoverTrigger>
            <TooltipContent>Account settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent align="end" className="w-80 p-4" sideOffset={8}>
          <div className="mb-4 min-w-0">
            <div className="font-medium text-sm">Account settings</div>
            <div className="truncate text-muted-foreground text-xs">
              {email}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-xs">Billing</div>
                  <div className="text-muted-foreground text-xs">
                    {billing.planLabel} / {billing.status}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Workspaces: {billing.workspaceCount} /{" "}
                    {billing.workspaceLimit}
                  </div>
                </div>
                <SparklesIcon className="size-4 shrink-0 text-primary" />
              </div>
              {billing.checkoutConfigured ? (
                <div className="grid gap-2">
                  <Button
                    disabled={isPending}
                    onClick={openBillingDialog}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    View plans
                  </Button>
                  <Button
                    disabled={isPending}
                    onClick={openBillingPortal}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {billingAction === "portal"
                      ? "Opening..."
                      : "Manage billing"}
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Polar is not configured yet. Add POLAR env vars to enable
                  checkout.
                </p>
              )}
              {billing.checkoutConfigured && !billing.webhookConfigured ? (
                <p className="mt-2 text-amber-700 text-xs dark:text-amber-300">
                  Checkout can open, but subscription sync is not active until
                  POLAR_WEBHOOK_SECRET is configured.
                </p>
              ) : null}
              {billingError ? (
                <p className="mt-2 text-destructive text-xs">{billingError}</p>
              ) : null}
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-xs">Command palette</div>
                  <div className="text-muted-foreground text-xs">
                    Bind:{" "}
                    {getCommandPaletteShortcutLabel(commandPaletteShortcut)}
                  </div>
                </div>
                <TooltipHint content="Open command palette">
                  <Button
                    aria-label="Open command palette"
                    onClick={openCommandPalette}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    <CommandIcon />
                  </Button>
                </TooltipHint>
              </div>
              <Label className="mb-1.5 block" htmlFor="command-palette-bind">
                Keyboard bind
              </Label>
              <Select
                onValueChange={(value) =>
                  changeCommandPaletteShortcut(value as CommandPaletteShortcut)
                }
                value={commandPaletteShortcut}
              >
                <SelectTrigger
                  aria-label="Command palette keyboard bind"
                  className="w-full"
                  id="command-palette-bind"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {commandPaletteShortcutOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={currentPasswordId}>Current password</Label>
              <TooltipHint content="Your current account password">
                <Input
                  autoComplete="current-password"
                  id={currentPasswordId}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  type="password"
                  value={currentPassword}
                />
              </TooltipHint>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={newPasswordId}>New password</Label>
              <TooltipHint content="Enter the new password">
                <Input
                  autoComplete="new-password"
                  id={newPasswordId}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  value={newPassword}
                />
              </TooltipHint>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={confirmPasswordId}>Confirm password</Label>
              <TooltipHint content="Repeat the new password">
                <Input
                  autoComplete="new-password"
                  id={confirmPasswordId}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  value={confirmPassword}
                />
              </TooltipHint>
            </div>
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
            {success ? (
              <p className="flex items-center gap-1 text-primary text-xs">
                <CheckIcon className="size-3" />
                {success}
              </p>
            ) : null}
            <TooltipHint content="Change your password and revoke other sessions">
              <Button
                className="w-full"
                disabled={isPending || !(currentPassword && newPassword)}
                onClick={changePassword}
                type="button"
              >
                <KeyRoundIcon />
                {isPending ? "Updating..." : "Update password"}
              </Button>
            </TooltipHint>
          </div>
        </PopoverContent>
      </Popover>
      <TooltipHint content="Sign out">
        <Button
          disabled={isPending}
          onClick={signOut}
          size="icon"
          type="button"
          variant="outline"
        >
          <LogOutIcon />
          <span className="sr-only">Sign out</span>
        </Button>
      </TooltipHint>
    </div>
  );
};
