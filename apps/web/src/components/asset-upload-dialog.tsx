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
import { cn } from "@workspace/ui/lib/utils";
import { CloudUploadIcon, FileIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

const bytesPerKilobyte = 1024;
const kilobytesPerMegabyte = 1024;
const maxUploadMegabytes = 250;
const maxUploadBytes =
  maxUploadMegabytes * kilobytesPerMegabyte * bytesPerKilobyte;
const progressIntentStarted = 5;
const progressIntentCreated = 35;
const progressContentUploaded = 75;
const progressComplete = 100;
const progressPercentDenominator = 100;
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
  folderPath,
  onProgress,
  workspaceId,
}: {
  cdnEnabled: boolean;
  file: File;
  folderPath?: string;
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
      folderPath,
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
  folderPath,
  workspaceId,
}: {
  disabled?: boolean;
  folderPath?: string;
  workspaceId?: string;
}) => {
  const router = useRouter();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setFiles([]);
    setCurrentFilename(null);
    setIsDragging(false);
    setIsUploading(false);
    setError(null);
    setProgress(0);
  };

  const uploadFiles = async (nextFiles: File[]) => {
    if (!(nextFiles.length && workspaceId) || isUploading) {
      return;
    }

    setFiles(nextFiles);
    setIsUploading(true);
    setError(null);
    setProgress(progressIntentStarted);

    try {
      for (const [index, nextFile] of nextFiles.entries()) {
        const baseProgress = (index / nextFiles.length) * progressComplete;
        const progressShare = progressComplete / nextFiles.length;

        setCurrentFilename(nextFile.name);
        await uploadAsset({
          cdnEnabled: false,
          file: nextFile,
          folderPath,
          onProgress: (value) =>
            setProgress(
              Math.round(
                baseProgress +
                  (value / progressPercentDenominator) * progressShare
              )
            ),
          workspaceId,
        });
      }

      setOpen(false);
      reset();
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed"
      );
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!(nextOpen || isUploading)) {
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
            Add a private media file to the active folder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={fileInputId}>File</Label>
            <Input
              accept="image/*,video/*,audio/*,application/pdf,text/plain"
              className="sr-only"
              disabled={isUploading}
              id={fileInputId}
              multiple
              onChange={(event) => {
                uploadFiles(Array.from(event.target.files ?? [])).catch(
                  (uploadError: unknown) => {
                    setError(
                      uploadError instanceof Error
                        ? uploadError.message
                        : "Upload failed"
                    );
                  }
                );
                event.target.value = "";
              }}
              ref={fileInputRef}
              tabIndex={-1}
              type="file"
            />
            <button
              className={cn(
                "flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center transition-colors",
                isDragging && "border-primary bg-primary/5",
                isUploading && "cursor-not-allowed opacity-60"
              )}
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);

                if (isUploading) {
                  return;
                }

                uploadFiles(Array.from(event.dataTransfer.files)).catch(
                  (uploadError: unknown) => {
                    setError(
                      uploadError instanceof Error
                        ? uploadError.message
                        : "Upload failed"
                    );
                  }
                );
              }}
              type="button"
            >
              <CloudUploadIcon className="size-8 text-muted-foreground" />
              <span className="font-medium text-sm">Drop files or browse</span>
              <span className="text-muted-foreground text-xs">
                Images, video, audio, PDF, or text up to {maxUploadMegabytes} MB
              </span>
            </button>
          </div>

          {files.length ? (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 text-xs">
                <div className="truncate font-medium">
                  {isUploading && currentFilename
                    ? currentFilename
                    : `${files.length} file${files.length === 1 ? "" : "s"} selected`}
                </div>
                <div className="truncate text-muted-foreground">
                  {isUploading
                    ? "Uploading..."
                    : `${files
                        .reduce((total, nextFile) => total + nextFile.size, 0)
                        .toLocaleString()} bytes total`}
                </div>
              </div>
            </div>
          ) : null}

          {progress > 0 ? <Progress value={progress} /> : null}
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            disabled={isUploading || !files.length || !workspaceId}
            onClick={() => {
              uploadFiles(files).catch((uploadError: unknown) => {
                setError(
                  uploadError instanceof Error
                    ? uploadError.message
                    : "Upload failed"
                );
              });
            }}
          >
            <CloudUploadIcon />
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
