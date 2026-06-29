"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { CloudUploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { uploadFilesSequentially } from "@/components/asset-upload-client";

const progressIntentStarted = 1;

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
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = async (files: File[]) => {
    if (!(files.length && workspaceId) || isUploading) {
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      await uploadFilesSequentially({
        cdnEnabled: false,
        files,
        folderPath,
        onFileStart: () => undefined,
        onProgress: () => progressIntentStarted,
        workspaceId,
      });
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      <Input
        accept="image/*,video/*,audio/*,application/pdf,text/plain"
        className="sr-only"
        disabled={disabled || isUploading}
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
              setIsUploading(false);
            }
          );
          event.target.value = "";
        }}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      <Button
        disabled={disabled || isUploading}
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        <CloudUploadIcon />
        {isUploading ? "Uploading..." : "Upload"}
      </Button>
      {error ? (
        <div className="absolute right-0 mt-1 w-56 text-destructive text-xs">
          {error}
        </div>
      ) : null}
    </div>
  );
};
