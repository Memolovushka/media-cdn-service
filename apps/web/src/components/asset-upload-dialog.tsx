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
import { Progress } from "@workspace/ui/components/progress";
import { CloudUploadIcon, FileIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

const bytesPerKilobyte = 1024;
const kilobytesPerMegabyte = 1024;
const maxUploadMegabytes = 250;
const maxUploadBytes =
  maxUploadMegabytes * kilobytesPerMegabyte * bytesPerKilobyte;
const progressIntentStarted = 5;
const progressIntentCreated = 35;
const progressContentUploaded = 75;
const progressComplete = 100;
const allowedMimePrefixes = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "text/plain",
];

interface UploadIntentResponse {
  assetId: string;
  upload: {
    method: "PUT";
    url: string;
  };
  versionId: string;
}

const isAllowedMimeType = (mimeType: string) =>
  allowedMimePrefixes.some((prefix) =>
    prefix.endsWith("/") ? mimeType.startsWith(prefix) : mimeType === prefix
  );

const getErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "Upload failed";
};

const uploadAsset = async ({
  cdnEnabled,
  file,
  onProgress,
  workspaceId,
}: {
  cdnEnabled: boolean;
  file: File;
  onProgress: (value: number) => void;
  workspaceId: string;
}) => {
  if (file.size > maxUploadBytes) {
    throw new Error(`File is larger than ${maxUploadMegabytes} MB`);
  }

  if (!isAllowedMimeType(file.type)) {
    throw new Error("MIME type is not allowed");
  }

  const intentResponse = await fetch("/api/assets/uploads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workspaceId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      cdnEnabled,
    }),
  });

  if (!intentResponse.ok) {
    throw new Error(await getErrorMessage(intentResponse));
  }

  const intent = (await intentResponse.json()) as UploadIntentResponse;
  onProgress(progressIntentCreated);

  const contentResponse = await fetch(intent.upload.url, {
    method: intent.upload.method,
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!contentResponse.ok) {
    throw new Error(await getErrorMessage(contentResponse));
  }

  onProgress(progressContentUploaded);

  const completeResponse = await fetch(
    `/api/assets/${intent.assetId}/complete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ versionId: intent.versionId }),
    }
  );

  if (!completeResponse.ok) {
    throw new Error(await getErrorMessage(completeResponse));
  }

  onProgress(progressComplete);
};

export const AssetUploadDialog = ({
  disabled,
  workspaceId,
}: {
  disabled?: boolean;
  workspaceId?: string;
}) => {
  const router = useRouter();
  const fileInputId = useId();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setFile(null);
    setError(null);
    setProgress(0);
  };

  const upload = () => {
    if (!(file && workspaceId)) {
      return;
    }

    setError(null);
    setProgress(progressIntentStarted);

    startTransition(async () => {
      try {
        await uploadAsset({
          cdnEnabled: false,
          file,
          onProgress: setProgress,
          workspaceId,
        });
        setOpen(false);
        reset();
        router.refresh();
      } catch (uploadError) {
        setError(
          uploadError instanceof Error ? uploadError.message : "Upload failed"
        );
        setProgress(0);
      }
    });
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!(nextOpen || isPending)) {
          reset();
        }
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <CloudUploadIcon />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload asset</DialogTitle>
          <DialogDescription>
            Add a private media file to the active workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={fileInputId}>File</Label>
            <Input
              accept="image/*,video/*,audio/*,application/pdf,text/plain"
              disabled={isPending}
              id={fileInputId}
              onChange={(event) => {
                setFile(event.target.files?.item(0) ?? null);
                setError(null);
              }}
              type="file"
            />
          </div>

          {file ? (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 text-xs">
                <div className="truncate font-medium">{file.name}</div>
                <div className="truncate text-muted-foreground">
                  {file.type || "unknown"} · {file.size.toLocaleString()} bytes
                </div>
              </div>
            </div>
          ) : null}

          {progress > 0 ? <Progress value={progress} /> : null}
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            disabled={isPending || !file || !workspaceId}
            onClick={upload}
          >
            <CloudUploadIcon />
            {isPending ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
