"use client";

import { Button } from "@workspace/ui/components/button";
import { LogOutIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/auth/client";

export const AccountActions = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const signOut = () => {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/auth?mode=signin");
      router.refresh();
    });
  };

  return (
    <>
      <Button asChild size="icon" variant="outline">
        <a href="/settings/account">
          <SettingsIcon />
          <span className="sr-only">Account settings</span>
        </a>
      </Button>
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
    </>
  );
};
