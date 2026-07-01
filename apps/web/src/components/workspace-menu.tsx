"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Building2Icon, ChevronDownIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";

export interface WorkspaceMenuItem {
  id: string;
  name: string;
}

interface WorkspaceCreateResponse {
  workspace?: {
    id: string;
  };
}

const getErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "Workspace creation failed";
};

export const WorkspaceMenu = ({
  activeWorkspaceId,
  workspaces,
}: {
  activeWorkspaceId: string;
  workspaces: WorkspaceMenuItem[];
}) => {
  const router = useRouter();
  const nameId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("My media workspace");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    workspaces.at(0);

  const createWorkspace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }

      const payload = (await response
        .json()
        .catch(() => null)) as WorkspaceCreateResponse | null;
      const nextWorkspaceId = payload?.workspace?.id;

      setName("My media workspace");
      setOpen(false);

      if (nextWorkspaceId) {
        router.push(`/?workspace=${encodeURIComponent(nextWorkspaceId)}`);
        return;
      }

      router.refresh();
    });
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setError(null);
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button className="h-6 px-2" size="sm" type="button" variant="outline">
          <Building2Icon />
          <span className="max-w-44 truncate">
            {activeWorkspace?.name ?? "Workspace"}
          </span>
          <ChevronDownIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workspaces</DialogTitle>
          <DialogDescription>
            Create a separate workspace for another project or client.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {workspaces.map((workspace) => (
            <Button
              className="w-full justify-start"
              key={workspace.id}
              onClick={() => {
                setOpen(false);
                router.push(`/?workspace=${encodeURIComponent(workspace.id)}`);
              }}
              type="button"
              variant={
                workspace.id === activeWorkspaceId ? "secondary" : "ghost"
              }
            >
              <Building2Icon />
              <span className="truncate">{workspace.name}</span>
            </Button>
          ))}
        </div>
        <form className="space-y-4" onSubmit={createWorkspace}>
          <div className="space-y-2">
            <Label htmlFor={nameId}>New workspace name</Label>
            <Input
              id={nameId}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button disabled={isPending || !name.trim()}>
              <PlusIcon />
              {isPending ? "Creating..." : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
