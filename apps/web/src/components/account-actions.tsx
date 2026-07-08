"use client";

import { Button } from "@workspace/ui/components/button";
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

interface AccountActionsProps {
  billing: {
    checkoutConfigured: boolean;
    plan: string;
    planLabel: string;
    status: string;
    webhookConfigured: boolean;
    workspaceCount: number;
    workspaceLimit: number;
  };
  email?: null | string;
  products: Array<{
    label: string;
    slug: string;
  }>;
}

const minPasswordLength = 8;

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

export const AccountActions = ({
  billing,
  email,
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
    startTransition(async () => {
      const checkoutClient = authClient as typeof authClient & {
        checkout: (input: { slug: string }) => Promise<unknown>;
      };

      await checkoutClient.checkout({ slug });
      setBillingAction(null);
    });
  };

  const openBillingPortal = () => {
    setBillingAction("portal");
    startTransition(async () => {
      const portalClient = authClient as typeof authClient & {
        customer: {
          portal: () => Promise<unknown>;
        };
      };

      await portalClient.customer.portal();
      setBillingAction(null);
    });
  };

  return (
    <div className="flex gap-2">
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
                  <div className="grid grid-cols-2 gap-2">
                    {products.map((product) => (
                      <Button
                        disabled={isPending}
                        key={product.slug}
                        onClick={() => startCheckout(product.slug)}
                        size="sm"
                        type="button"
                        variant={
                          billing.plan === product.slug
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {billingAction === product.slug
                          ? "Opening..."
                          : product.label}
                      </Button>
                    ))}
                  </div>
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
