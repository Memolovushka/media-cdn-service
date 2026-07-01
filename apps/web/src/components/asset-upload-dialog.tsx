"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { CloudUploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef } from "react";
import {
  AssetUploadTray,
  useAssetUploadQueue,
} from "@/components/asset-upload-queue";
import { TooltipHint } from "@/components/tooltip-hint";

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
  const uploadQueue = useAssetUploadQueue({
    onSettled: router.refresh,
    workspaceId,
  });
  const isUploading =
    uploadQueue.summary.uploading > 0 || uploadQueue.summary.waiting > 0;

  return (
    <div className="relative">
      <Input
        accept="image/*,video/*,audio/*,application/pdf,text/plain"
        className="sr-only"
        disabled={disabled || isUploading}
        id={fileInputId}
        multiple
        onChange={(event) => {
          uploadQueue.enqueueFiles(
            Array.from(event.target.files ?? []),
            folderPath
          );
          event.target.value = "";
        }}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      <TooltipHint content="Upload files to the current folder">
        <Button
          disabled={disabled || isUploading}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <CloudUploadIcon />
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
      </TooltipHint>
      <AssetUploadTray {...uploadQueue} />
    </div>
  );
};
