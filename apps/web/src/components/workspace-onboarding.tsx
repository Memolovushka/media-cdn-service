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
import { Building2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

export const WorkspaceOnboarding = () => {
  const router = useRouter();
  const inputId = useId();
  const [name, setName] = useState("My media workspace");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const createWorkspace = () => {
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
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Workspace creation failed");
        return;
      }

      router.refresh();
    });
  };

  return (
    <section className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-muted">
            <Building2Icon className="size-4 text-muted-foreground" />
          </div>
          <CardTitle>Create your first workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={inputId}>Workspace name</Label>
            <Input
              id={inputId}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </div>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <Button
            disabled={isPending || !name.trim()}
            onClick={createWorkspace}
          >
            <Building2Icon />
            {isPending ? "Creating..." : "Create workspace"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
};
