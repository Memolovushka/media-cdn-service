"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/auth/client";

interface AccountMenuProps {
  email?: null | string;
  name?: null | string;
}

const getInitials = ({ email, name }: AccountMenuProps) => {
  const source = name || email || "User";

  return source.slice(0, 2).toUpperCase();
};

export const AccountMenu = ({ email, name }: AccountMenuProps) => {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="lg" variant="outline">
          <Avatar size="sm">
            <AvatarFallback>{getInitials({ email, name })}</AvatarFallback>
          </Avatar>
          Account
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium text-foreground">
              {name || "Account"}
            </span>
            <span className="truncate">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/settings/account">
            <SettingsIcon />
            Account settings
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/settings/account">
            <UserIcon />
            Change password
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending}
          onSelect={(event) => {
            event.preventDefault();
            signOut();
          }}
          variant="destructive"
        >
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
