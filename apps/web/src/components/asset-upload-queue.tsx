"use client";

import { Button } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloudUploadIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { uploadAsset } from "@/components/asset-upload-client";

type UploadQueueStatus = "failed" | "ready" | "uploading" | "waiting";

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

const maxVisibleItems = 4;

const getQueueItemId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

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
  onSettled,
  workspaceId,
}: {
  onSettled: () => void;
  workspaceId?: string;
}) => {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const isRunningRef = useRef(false);

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

  const enqueueFiles = useCallback(
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
    clearCompleted,
    dismissQueue,
    enqueueFiles,
    items,
    retryItem,
    summary,
  };
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
