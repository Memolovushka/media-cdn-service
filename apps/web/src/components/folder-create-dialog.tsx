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
import { FolderPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

const getErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "Folder creation failed";
};

export const FolderCreateDialog = ({
  disabled,
  parentPath,
  workspaceId,
}: {
  disabled?: boolean;
  parentPath?: string;
  workspaceId?: string;
}) => {
  const router = useRouter();
  const nameId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const createFolder = () => {
    if (!(workspaceId && name.trim())) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          parentPath,
          name,
        }),
      });

      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }

      setName("");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button disabled={disabled} variant="outline">
          <FolderPlusIcon />
          New folder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create folder</DialogTitle>
          <DialogDescription>
            Add a folder inside the current workspace view.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={nameId}>Folder name</Label>
          <Input
            autoFocus
            id={nameId}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            disabled={isPending || !workspaceId || !name.trim()}
            onClick={createFolder}
          >
            <FolderPlusIcon />
            {isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
