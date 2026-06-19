"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { CheckIcon, KeyRoundIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { authClient } from "@/auth/client";

interface AccountSettingsFormProps {
  email?: null | string;
  name?: null | string;
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

export const AccountSettingsForm = ({
  email,
  name,
}: AccountSettingsFormProps) => {
  const router = useRouter();
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resetPasswordFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
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

      resetPasswordFields();
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Name</div>
              <div className="truncate font-medium text-sm">{name || "-"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Email</div>
              <div className="truncate font-medium text-sm">{email}</div>
            </div>
          </div>
          <Button disabled={isPending} onClick={signOut} variant="outline">
            <LogOutIcon />
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={currentPasswordId}>Current password</Label>
            <Input
              autoComplete="current-password"
              id={currentPasswordId}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              value={currentPassword}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={newPasswordId}>New password</Label>
            <Input
              autoComplete="new-password"
              id={newPasswordId}
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              value={newPassword}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={confirmPasswordId}>Confirm new password</Label>
            <Input
              autoComplete="new-password"
              id={confirmPasswordId}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              value={confirmPassword}
            />
          </div>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          {success ? (
            <p className="flex items-center gap-1 text-primary text-xs">
              <CheckIcon className="size-3" />
              {success}
            </p>
          ) : null}
          <Button
            disabled={isPending || !(currentPassword && newPassword)}
            onClick={changePassword}
          >
            <KeyRoundIcon />
            {isPending ? "Updating..." : "Update password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
