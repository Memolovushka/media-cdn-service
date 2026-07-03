"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Progress } from "@workspace/ui/components/progress";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloudUploadIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  maxUploadMegabytes,
  uploadAsset,
} from "@/components/asset-upload-client";

type UploadQueueStatus = "failed" | "ready" | "uploading" | "waiting";

interface ExistingUploadAsset {
  filename: string;
  folderPath: string;
}

interface UploadQueueItem {
  error?: string;
  file: File;
  folderPath?: string;
  id: string;
  name: string;
  progress: number;
  sizeBytes: number;
  status: UploadQueueStatus;
}

interface UploadReviewItem {
  conflict: boolean;
  file: File;
  id: string;
  issue?: string;
  name: string;
  sizeBytes: number;
  typeLabel: string;
}

interface UploadReviewRequest {
  folderPath?: string;
  items: UploadReviewItem[];
}

const maxVisibleItems = 4;
const bytesPerUnit = 1024;
const acceptedUploadMimeTypesLabel = "Images, video, audio, PDF, and text";
const allowedMimePrefixes = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "text/plain",
];

const getQueueItemId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const formatBytes = (bytes: number) => {
  if (bytes < bytesPerUnit) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / bytesPerUnit;
  let unitIndex = 0;

  while (value >= bytesPerUnit && unitIndex < units.length - 1) {
    value /= bytesPerUnit;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const isAllowedMimeType = (mimeType: string) =>
  allowedMimePrefixes.some((prefix) =>
    prefix.endsWith("/") ? mimeType.startsWith(prefix) : mimeType === prefix
  );

const getFileIssue = (file: File) => {
  if (file.size > maxUploadMegabytes * bytesPerUnit * bytesPerUnit) {
    return `Larger than ${maxUploadMegabytes} MB`;
  }

  if (!isAllowedMimeType(file.type)) {
    return "Unsupported type";
  }

  return;
};

const getStatusLabel = (status: UploadQueueStatus) => {
  switch (status) {
    case "failed":
      return "Failed";
    case "ready":
      return "Ready";
    case "uploading":
      return "Uploading";
    case "waiting":
      return "Waiting";
    default:
      return status satisfies never;
  }
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Upload failed";

export const useAssetUploadQueue = ({
  existingAssets = [],
  onSettled,
  workspaceId,
}: {
  existingAssets?: ExistingUploadAsset[];
  onSettled: () => void;
  workspaceId?: string;
}) => {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [reviewRequest, setReviewRequest] =
    useState<UploadReviewRequest | null>(null);
  const isRunningRef = useRef(false);
  const existingNameKeys = useMemo(
    () =>
      new Set(
        existingAssets.map(
          (asset) =>
            `${asset.folderPath.toLowerCase()}/${asset.filename.toLowerCase()}`
        )
      ),
    [existingAssets]
  );

  const runQueue = useCallback(async () => {
    if (isRunningRef.current || !workspaceId) {
      return;
    }

    isRunningRef.current = true;
    let uploadedAny = false;

    try {
      while (true) {
        const nextItem = await new Promise<UploadQueueItem | undefined>(
          (resolve) => {
            setItems((currentItems) => {
              const item = currentItems.find(
                (candidate) => candidate.status === "waiting"
              );

              resolve(item);

              if (!item) {
                return currentItems;
              }

              return currentItems.map((candidate) =>
                candidate.id === item.id
                  ? {
                      ...candidate,
                      error: undefined,
                      progress: 1,
                      status: "uploading",
                    }
                  : candidate
              );
            });
          }
        );

        if (!nextItem) {
          break;
        }

        try {
          await uploadAsset({
            cdnEnabled: false,
            file: nextItem.file,
            folderPath: nextItem.folderPath,
            onProgress: (progress) => {
              setItems((currentItems) =>
                currentItems.map((item) =>
                  item.id === nextItem.id ? { ...item, progress } : item
                )
              );
            },
            workspaceId,
          });

          uploadedAny = true;
          setItems((currentItems) =>
            currentItems.map((item) =>
              item.id === nextItem.id
                ? { ...item, progress: 100, status: "ready" }
                : item
            )
          );
        } catch (error) {
          setItems((currentItems) =>
            currentItems.map((item) =>
              item.id === nextItem.id
                ? {
                    ...item,
                    error: getErrorMessage(error),
                    progress: 0,
                    status: "failed",
                  }
                : item
            )
          );
        }
      }
    } finally {
      isRunningRef.current = false;

      if (uploadedAny) {
        onSettled();
      }
    }
  }, [onSettled, workspaceId]);

  const addFilesToQueue = useCallback(
    (files: File[], folderPath?: string) => {
      if (!(files.length && workspaceId)) {
        return;
      }

      const nextItems = files.map((file) => ({
        file,
        folderPath,
        id: getQueueItemId(),
        name: file.name,
        progress: 0,
        sizeBytes: file.size,
        status: "waiting" as const,
      }));

      setItems((currentItems) => [...currentItems, ...nextItems]);
      window.setTimeout(() => {
        runQueue().catch(() => undefined);
      }, 0);
    },
    [runQueue, workspaceId]
  );

  const enqueueFiles = useCallback(
    (files: File[], folderPath?: string) => {
      if (!(files.length && workspaceId)) {
        return;
      }

      setReviewRequest({
        folderPath,
        items: files.map((file) => ({
          conflict: existingNameKeys.has(
            `${(folderPath ?? "asset").toLowerCase()}/${file.name.toLowerCase()}`
          ),
          file,
          id: getQueueItemId(),
          issue: getFileIssue(file),
          name: file.name,
          sizeBytes: file.size,
          typeLabel: file.type || "Unknown type",
        })),
      });
    },
    [existingNameKeys, workspaceId]
  );

  const cancelUploadReview = useCallback(() => {
    setReviewRequest(null);
  }, []);

  const confirmUploadReview = useCallback(() => {
    if (!reviewRequest) {
      return;
    }

    const validFiles = reviewRequest.items
      .filter((item) => !item.issue)
      .map((item) => item.file);

    addFilesToQueue(validFiles, reviewRequest.folderPath);
    setReviewRequest(null);
  }, [addFilesToQueue, reviewRequest]);

  const retryItem = useCallback(
    (itemId: string) => {
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId
            ? { ...item, error: undefined, progress: 0, status: "waiting" }
            : item
        )
      );
      window.setTimeout(() => {
        runQueue().catch(() => undefined);
      }, 0);
    },
    [runQueue]
  );

  const clearCompleted = useCallback(() => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.status !== "ready")
    );
  }, []);

  const dismissQueue = useCallback(() => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.status === "uploading")
    );
  }, []);

  const summary = useMemo(() => {
    const failed = items.filter((item) => item.status === "failed").length;
    const ready = items.filter((item) => item.status === "ready").length;
    const uploading = items.filter(
      (item) => item.status === "uploading"
    ).length;
    const waiting = items.filter((item) => item.status === "waiting").length;

    return { failed, ready, uploading, waiting };
  }, [items]);

  return {
    cancelUploadReview,
    clearCompleted,
    confirmUploadReview,
    dismissQueue,
    enqueueFiles,
    items,
    reviewRequest,
    retryItem,
    summary,
  };
};

export const AssetUploadReviewDialog = ({
  cancelUploadReview,
  confirmUploadReview,
  reviewRequest,
}: {
  cancelUploadReview: () => void;
  confirmUploadReview: () => void;
  reviewRequest: UploadReviewRequest | null;
}) => {
  const reviewSummary = useMemo(() => {
    const items = reviewRequest?.items ?? [];
    const totalBytes = items.reduce((total, item) => total + item.sizeBytes, 0);
    const blockedCount = items.filter((item) => item.issue).length;
    const conflictCount = items.filter((item) => item.conflict).length;

    return {
      conflictCount,
      totalBytes,
      validCount: items.length - blockedCount,
    };
  }, [reviewRequest]);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          cancelUploadReview();
        }
      }}
      open={Boolean(reviewRequest)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review upload</DialogTitle>
          <DialogDescription>
            Check the batch before files are added to the private upload queue.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 p-3 text-xs">
            <div>
              <div className="text-muted-foreground">Destination</div>
              <div className="truncate font-medium">
                {reviewRequest?.folderPath ?? "asset"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Batch size</div>
              <div className="font-medium">
                {formatBytes(reviewSummary.totalBytes)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Accepted types</div>
              <div className="font-medium">{acceptedUploadMimeTypesLabel}</div>
            </div>
            <div>
              <div className="text-muted-foreground">CDN state</div>
              <div className="font-medium">Private by default</div>
            </div>
          </div>
          {reviewSummary.conflictCount ? (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-700 text-xs dark:text-amber-300">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                {reviewSummary.conflictCount} filename conflict
                {reviewSummary.conflictCount === 1 ? "" : "s"} found. Upload is
                storage-safe and will keep both files; rename after upload if
                the list should be clearer.
              </span>
            </div>
          ) : null}
          <div className="max-h-72 overflow-y-auto rounded-md border">
            {(reviewRequest?.items ?? []).map((item) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-3 py-2 last:border-b-0"
                key={item.id}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-xs">
                    {item.name}
                  </div>
                  <div className="truncate text-muted-foreground text-xs">
                    {item.typeLabel} | {formatBytes(item.sizeBytes)}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {item.conflict ? (
                    <span className="rounded border border-amber-500/40 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">
                      Keep both
                    </span>
                  ) : null}
                  {item.issue ? (
                    <span className="rounded border border-destructive/40 px-1.5 py-0.5 text-destructive">
                      {item.issue}
                    </span>
                  ) : (
                    <span className="rounded border px-1.5 py-0.5 text-muted-foreground">
                      Ready
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={cancelUploadReview} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={reviewSummary.validCount === 0}
            onClick={confirmUploadReview}
            type="button"
          >
            Add {reviewSummary.validCount} to queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const AssetUploadTray = ({
  clearCompleted,
  dismissQueue,
  items,
  retryItem,
  summary,
}: {
  clearCompleted: () => void;
  dismissQueue: () => void;
  items: UploadQueueItem[];
  retryItem: (itemId: string) => void;
  summary: {
    failed: number;
    ready: number;
    uploading: number;
    waiting: number;
  };
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!items.length) {
    return null;
  }

  const activeCount = summary.uploading + summary.waiting;
  let statusText = `${summary.ready} complete`;

  if (activeCount > 0) {
    statusText = `${activeCount} active`;
  } else if (summary.failed > 0) {
    statusText = `${summary.failed} failed`;
  }

  const totalProgress =
    items.reduce((total, item) => total + item.progress, 0) / items.length;

  return (
    <aside className="fixed right-4 bottom-4 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
      <div className="flex items-center gap-3 border-b px-3 py-2">
        <CloudUploadIcon className="size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">Upload queue</div>
          <div className="text-muted-foreground text-xs">{statusText}</div>
        </div>
        {summary.ready > 0 ? (
          <Button
            onClick={clearCompleted}
            size="sm"
            type="button"
            variant="ghost"
          >
            Clear
          </Button>
        ) : null}
        <Button
          aria-label={
            collapsed ? "Expand upload queue" : "Collapse upload queue"
          }
          onClick={() => setCollapsed((value) => !value)}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          {collapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </Button>
        <Button
          aria-label="Dismiss completed uploads"
          onClick={dismissQueue}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>
      <Progress className="h-1 rounded-none" value={totalProgress} />
      {collapsed ? null : (
        <div className="max-h-72 overflow-y-auto p-2">
          {items.slice(0, maxVisibleItems).map((item) => (
            <div
              className="flex items-center gap-2 rounded-md px-2 py-2"
              key={item.id}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-xs">{item.name}</div>
                <div className="truncate text-muted-foreground text-xs">
                  {item.error ?? getStatusLabel(item.status)}
                </div>
                <Progress className="mt-1 h-1" value={item.progress} />
              </div>
              {item.status === "ready" ? (
                <CheckIcon className="size-4 text-primary" />
              ) : null}
              {item.status === "failed" ? (
                <Button
                  aria-label={`Retry upload ${item.name}`}
                  onClick={() => retryItem(item.id)}
                  size="icon-xs"
                  type="button"
                  variant="outline"
                >
                  <RotateCcwIcon />
                </Button>
              ) : null}
            </div>
          ))}
          {items.length > maxVisibleItems ? (
            <div className="px-2 py-1 text-muted-foreground text-xs">
              +{items.length - maxVisibleItems} more files
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
};
