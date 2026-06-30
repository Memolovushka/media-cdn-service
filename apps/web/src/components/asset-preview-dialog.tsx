"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { EyeIcon } from "lucide-react";

const getPreviewKind = (mimeType: string) => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) {
    return "frame";
  }

  return "unsupported";
};

export const AssetPreviewDialog = ({
  disabled,
  filename,
  mimeType,
  previewUrl,
}: {
  disabled?: boolean;
  filename: string;
  mimeType: string;
  previewUrl?: null | string;
}) => {
  const previewKind = getPreviewKind(mimeType);

  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <DialogTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                disabled={disabled || !previewUrl}
                size="icon"
                variant="ghost"
              >
                <EyeIcon />
                <span className="sr-only">Preview</span>
              </Button>
            </TooltipTrigger>
          </DialogTrigger>
          <TooltipContent>Preview file</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{filename}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-64 items-center justify-center rounded-md border bg-muted/20 p-2">
          {previewKind === "image" && previewUrl ? (
            <object
              aria-label={filename}
              className="max-h-[70vh] min-h-64 w-full rounded-md"
              data={previewUrl}
              type={mimeType}
            />
          ) : null}
          {previewKind === "video" && previewUrl ? (
            <video
              className="max-h-[70vh] max-w-full"
              controls
              src={previewUrl}
            >
              <track kind="captions" />
            </video>
          ) : null}
          {previewKind === "audio" && previewUrl ? (
            <audio className="w-full" controls src={previewUrl}>
              <track kind="captions" />
            </audio>
          ) : null}
          {previewKind === "frame" && previewUrl ? (
            <iframe
              className="h-[70vh] w-full rounded-md bg-background"
              src={previewUrl}
              title={filename}
            />
          ) : null}
          {previewKind === "unsupported" ? (
            <p className="text-muted-foreground text-sm">
              Preview is not available for this file type.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
