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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import {
  CheckIcon,
  KeyRoundIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { authClient } from "@/auth/client";
import { TooltipHint } from "@/components/tooltip-hint";

interface AccountActionsProps {
  email?: null | string;
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

export const AccountActions = ({ email }: AccountActionsProps) => {
  const router = useRouter();
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
