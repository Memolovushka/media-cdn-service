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
import {
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
} from "lucide-react";
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
  const renameNameId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("My media workspace");
  const [renameName, setRenameName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRenamePending, startRenameTransition] = useTransition();
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    workspaces.at(0);

  const openDialog = (nextOpen: boolean) => {
    setOpen(nextOpen);
    setError(null);
    setRenameError(null);

    if (nextOpen) {
      setRenameName(activeWorkspace?.name ?? "");
    }
  };

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

  const renameWorkspace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextName = renameName.trim();

    if (!(activeWorkspace && nextName && nextName !== activeWorkspace.name)) {
      return;
    }

    setRenameError(null);

    startRenameTransition(async () => {
      const response = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: nextName,
        }),
      });

      if (!response.ok) {
        setRenameError(await getErrorMessage(response));
        return;
      }

      router.refresh();
    });
  };

  return (
    <Dialog onOpenChange={openDialog} open={open}>
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
        <form className="space-y-3" onSubmit={renameWorkspace}>
          <div className="space-y-2">
            <Label htmlFor={renameNameId}>Current workspace name</Label>
            <div className="flex gap-2">
              <Input
                id={renameNameId}
                maxLength={80}
                onChange={(event) => setRenameName(event.target.value)}
                value={renameName}
              />
              <Button
                disabled={
                  isRenamePending ||
                  !renameName.trim() ||
                  renameName.trim() === activeWorkspace?.name
                }
                size="icon"
                type="submit"
                variant="outline"
              >
                <CheckIcon />
                <span className="sr-only">Rename workspace</span>
              </Button>
            </div>
            {renameError ? (
              <p className="text-destructive text-xs">{renameError}</p>
            ) : null}
          </div>
        </form>
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
