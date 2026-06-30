"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Progress } from "@workspace/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import {
  CheckSquareIcon,
  CloudUploadIcon,
  DownloadIcon,
  FolderInputIcon,
  Globe2Icon,
  SaveIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { AssetCdnControls } from "@/components/asset-cdn-controls";
import { uploadFilesSequentially } from "@/components/asset-upload-client";
import {
  AssetTableRowClient,
  FolderTableRowClient,
} from "@/components/file-manager-table-rows";
import { FolderCreateDialog } from "@/components/folder-create-dialog";

interface DashboardAssetVersion {
  id: string;
  publicUrl: null | string;
  uploadStatus: string;
}

export interface DashboardAsset {
  cdnEnabled: boolean;
  filename: string;
  folderPath: string;
  id: string;
  mimeType: string;
  sizeBytes: number;
  versions: DashboardAssetVersion[];
  workspaceId: string;
}

export interface DashboardFolder {
  id: string;
  name: string;
  path: string;
}

const bytesPerUnit = 1024;
const rootFolderPath = "asset";
const defaultTableColumnCount = 5;
const selectableTableColumnCount = 6;

interface AssetPatchResponse {
  asset?: Partial<DashboardAsset>;
  publicUrl?: null | string;
}

const hasFilesTransfer = (
  dataTransfer: DataTransfer | null
): dataTransfer is DataTransfer =>
  Boolean(dataTransfer?.types.includes("Files"));

const getAssetCdnState = (asset: DashboardAsset) => {
  const latestVersion = asset.versions.at(0) ?? null;
  const isPublished = asset.cdnEnabled && Boolean(latestVersion?.publicUrl);

  return {
    label: isPublished ? "CDN published" : "Not published",
    variant: isPublished ? ("default" as const) : ("outline" as const),
  };
};

const isAssetReady = (asset: DashboardAsset) =>
  asset.versions.at(0)?.uploadStatus === "ready";

const isAssetPublished = (asset: DashboardAsset) =>
  asset.cdnEnabled && Boolean(asset.versions.at(0)?.publicUrl);

const matchesSearch = (value: string, query: string) =>
  value.toLowerCase().includes(query.trim().toLowerCase());

const getNextSelectedAssetIds = ({
  assetId,
  currentIds,
  filteredAssets,
  lastSelectedAssetId,
  shiftKey,
  shouldSelect,
}: {
  assetId: string;
  currentIds: Set<string>;
  filteredAssets: DashboardAsset[];
  lastSelectedAssetId: null | string;
  shiftKey: boolean;
  shouldSelect: boolean;
}) => {
  const nextIds = new Set(currentIds);
  const currentIndex = filteredAssets.findIndex(
    (asset) => asset.id === assetId
  );
  const lastIndex = lastSelectedAssetId
    ? filteredAssets.findIndex((asset) => asset.id === lastSelectedAssetId)
    : -1;

  if (!(shiftKey && lastIndex >= 0 && currentIndex >= 0)) {
    if (shouldSelect) {
      nextIds.add(assetId);
    } else {
      nextIds.delete(assetId);
    }

    return nextIds;
  }

  const [startIndex, endIndex] =
    lastIndex < currentIndex
      ? [lastIndex, currentIndex]
      : [currentIndex, lastIndex];

  for (const asset of filteredAssets.slice(startIndex, endIndex + 1)) {
    if (shouldSelect) {
      nextIds.add(asset.id);
    } else {
      nextIds.delete(asset.id);
    }
  }

  return nextIds;
};

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

const getAssetUrls = (asset: DashboardAsset) => {
  const latestVersion = asset.versions.at(0) ?? null;
  const isReady = latestVersion?.uploadStatus === "ready";

  return {
    downloadUrl: isReady
      ? `/api/assets/${asset.id}/download?versionId=${latestVersion.id}`
      : null,
    latestVersion,
    previewUrl: isReady
      ? `/api/assets/${asset.id}/preview?versionId=${latestVersion.id}`
      : null,
  };
};

const getErrorMessage = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? fallback;
};

const isImageMimeType = (mimeType: string) => mimeType.startsWith("image/");

const assetHref = ({
  assetId,
  folderPath,
}: {
  assetId: string;
  folderPath: string;
}) => {
  const params = new URLSearchParams();

  if (folderPath) {
    params.set("folder", folderPath);
  }

  params.set("asset", assetId);

  return `/?${params.toString()}`;
};

const AssetDetailsPanelSkeleton = () => (
  <section className="flex flex-col gap-4 rounded-lg border p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
    <div className="flex gap-1">
      <Skeleton className="size-9" />
      <Skeleton className="size-9" />
    </div>
    <Skeleton className="h-24 w-full" />
  </section>
);

const AssetDetailsPanel = ({
  asset,
  isRefreshing,
  onAssetUpdated,
}: {
  asset?: DashboardAsset | null;
  isRefreshing: boolean;
  onAssetUpdated: (asset: DashboardAsset) => void;
}) => {
  const router = useRouter();
  const [filename, setFilename] = useState(asset?.filename ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setFilename(asset?.filename ?? "");
    setError(null);
  }, [asset?.filename]);

  if (!asset) {
    return (
      <section className="rounded-lg border p-4">
        <div className="flex h-44 items-center justify-center text-center text-muted-foreground text-sm">
          Select a file to manage preview, download, and CDN settings.
        </div>
      </section>
    );
  }

  if (isRefreshing) {
    return <AssetDetailsPanelSkeleton />;
  }

  const { downloadUrl, latestVersion, previewUrl } = getAssetUrls(asset);
  const isReady = latestVersion?.uploadStatus === "ready";
  const cdnState = getAssetCdnState(asset);
  const inlineImagePreviewUrl =
    previewUrl && isReady && isImageMimeType(asset.mimeType)
      ? previewUrl
      : null;
  const saveFilename = () => {
    const nextFilename = filename.trim();

    if (!nextFilename || nextFilename === asset.filename) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename: nextFilename }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        setError(payload?.error ?? "Rename failed");
        setFilename(asset.filename);
        return;
      }

      onAssetUpdated({ ...asset, filename: nextFilename });
      router.refresh();
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Input
              aria-label="Filename"
              className="h-8 min-w-0 font-semibold text-sm"
              disabled={isPending}
              onBlur={saveFilename}
              onChange={(event) => setFilename(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveFilename();
                }
              }}
              value={filename}
            />
            <Button
              disabled={isPending || !filename.trim()}
              onClick={saveFilename}
              onMouseDown={(event) => event.preventDefault()}
              size="icon"
              type="button"
              variant="outline"
            >
              <SaveIcon />
              <span className="sr-only">Rename file</span>
            </Button>
          </div>
          <div className="mt-1 truncate text-muted-foreground text-xs">
            {asset.mimeType} - {formatBytes(asset.sizeBytes)}
          </div>
          {error ? (
            <div className="mt-1 text-destructive text-xs">{error}</div>
          ) : null}
        </div>
        <Badge variant={cdnState.variant}>{cdnState.label}</Badge>
      </div>

      {inlineImagePreviewUrl ? (
        <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-lg border bg-muted/20">
          <object
            aria-label={`Preview of ${asset.filename}`}
            className="h-full max-h-[420px] min-h-56 w-full object-contain"
            data={inlineImagePreviewUrl}
            type={asset.mimeType}
          >
            <div className="flex min-h-56 items-center justify-center p-4 text-center text-muted-foreground text-sm">
              Preview is not available for this image.
            </div>
          </object>
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        {downloadUrl ? (
          <Button asChild size="icon" variant="ghost">
            <a href={downloadUrl}>
              <DownloadIcon />
              <span className="sr-only">Download</span>
            </a>
          </Button>
        ) : (
          <Button disabled size="icon" variant="ghost">
            <DownloadIcon />
            <span className="sr-only">Download</span>
          </Button>
        )}
      </div>

      <AssetCdnControls
        assetId={asset.id}
        cdnEnabled={asset.cdnEnabled}
        publicUrl={latestVersion?.publicUrl}
        ready={isReady}
        workspaceId={asset.workspaceId}
      />
    </section>
  );
};

// biome-ignore-start lint/complexity/noExcessiveCognitiveComplexity: This client surface coordinates file listing, upload, drag/drop, selection, and detail-panel actions.
export const FileManager = ({
  allFolders,
  assets,
  selectedAssetId,
  selectedFolderPath,
  visibleFolders,
  workspaceId,
}: {
  allFolders: DashboardFolder[];
  assets: DashboardAsset[];
  selectedAssetId?: string;
  selectedFolderPath: string;
  visibleFolders: DashboardFolder[];
  workspaceId: string;
}) => {
  const router = useRouter();
  const [optimisticAssets, setOptimisticAssets] = useState(assets);
  const [activeAssetId, setActiveAssetId] = useState(
    selectedAssetId || assets.at(0)?.id || ""
  );
  const [dragDepth, setDragDepth] = useState(0);
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropProgress, setDropProgress] = useState(0);
  const [dropUploadLabel, setDropUploadLabel] = useState<string | null>(null);
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [isDropUploading, setIsDropUploading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isRefreshingSelection, setIsRefreshingSelection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    () => new Set()
  );
  const [lastSelectedAssetId, setLastSelectedAssetId] = useState<string | null>(
    null
  );
  const [bulkMoveTarget, setBulkMoveTarget] = useState(rootFolderPath);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isBulkPending, startBulkTransition] = useTransition();

  useEffect(() => {
    setOptimisticAssets(assets);
    setActiveAssetId(selectedAssetId || assets.at(0)?.id || "");
    setIsRefreshingSelection(false);
    setSelectedAssetIds(new Set());
    setLastSelectedAssetId(null);
  }, [assets, selectedAssetId]);

  const selectedAsset = useMemo(
    () =>
      optimisticAssets.find((asset) => asset.id === activeAssetId) ??
      optimisticAssets.at(0) ??
      null,
    [activeAssetId, optimisticAssets]
  );
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) {
      return visibleFolders;
    }

    return visibleFolders.filter((folder) =>
      matchesSearch(`${folder.name} ${folder.path}`, searchQuery)
    );
  }, [searchQuery, visibleFolders]);
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) {
      return optimisticAssets;
    }

    return optimisticAssets.filter((asset) =>
      matchesSearch(`${asset.filename} ${asset.mimeType}`, searchQuery)
    );
  }, [optimisticAssets, searchQuery]);
  const selectedAssets = useMemo(
    () => optimisticAssets.filter((asset) => selectedAssetIds.has(asset.id)),
    [optimisticAssets, selectedAssetIds]
  );
  const publishableSelectedAssets = selectedAssets.filter(
    (asset) => isAssetReady(asset) && !isAssetPublished(asset)
  );
  const hasFileManagerItems = Boolean(
    filteredFolders.length || filteredAssets.length
  );
  const tableColumnCount = selectMode
    ? selectableTableColumnCount
    : defaultTableColumnCount;
  const selectedCount = selectedAssetIds.size;

  const handleDeleted = (assetId: string) => {
    setSelectedAssetIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(assetId);
      return nextIds;
    });
    setOptimisticAssets((currentAssets) => {
      const nextAssets = currentAssets.filter((asset) => asset.id !== assetId);

      if (activeAssetId === assetId) {
        setActiveAssetId(nextAssets.at(0)?.id || "");
      }

      return nextAssets;
    });
  };
  const handleAssetUpdated = (nextAsset: DashboardAsset) => {
    setOptimisticAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.id === nextAsset.id ? { ...asset, ...nextAsset } : asset
      )
    );
  };
  const handleBulkSelect = (
    assetId: string,
    shiftKey: boolean,
    shouldSelect: boolean
  ) => {
    setSelectedAssetIds((currentIds) =>
      getNextSelectedAssetIds({
        assetId,
        currentIds,
        filteredAssets,
        lastSelectedAssetId,
        shiftKey,
        shouldSelect,
      })
    );
    setLastSelectedAssetId(assetId);
  };
  const toggleSelectMode = () => {
    setSelectMode((currentMode) => {
      const nextMode = !currentMode;

      if (!nextMode) {
        setSelectedAssetIds(new Set());
        setLastSelectedAssetId(null);
      }

      return nextMode;
    });
  };
  const toggleAllVisibleAssets = (checked: boolean) => {
    setSelectedAssetIds((currentIds) => {
      const nextIds = new Set(currentIds);

      for (const asset of filteredAssets) {
        if (checked) {
          nextIds.add(asset.id);
        } else {
          nextIds.delete(asset.id);
        }
      }

      return nextIds;
    });
  };
  const publishSelectedAssets = () => {
    if (!publishableSelectedAssets.length || isBulkPending) {
      return;
    }

    setBulkError(null);
    startBulkTransition(async () => {
      for (const asset of publishableSelectedAssets) {
        const response = await fetch(`/api/assets/${asset.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cdnEnabled: true }),
        });

        if (!response.ok) {
          setBulkError(await getErrorMessage(response, "Publish failed"));
          return;
        }

        const payload = (await response
          .json()
          .catch(() => null)) as AssetPatchResponse | null;

        handleAssetUpdated({
          ...asset,
          cdnEnabled: true,
          versions: asset.versions.map((version, index) =>
            index === 0
              ? {
                  ...version,
                  publicUrl: payload?.publicUrl ?? version.publicUrl,
                }
              : version
          ),
        });
      }

      router.refresh();
    });
  };
  const moveSelectedAssets = () => {
    if (!(selectedAssets.length && bulkMoveTarget) || isBulkPending) {
      return;
    }

    setBulkError(null);
    startBulkTransition(async () => {
      const movedAssetIds = new Set<string>();

      for (const asset of selectedAssets) {
        if (asset.folderPath === bulkMoveTarget) {
          continue;
        }

        const response = await fetch(`/api/assets/${asset.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ folderPath: bulkMoveTarget }),
        });

        if (!response.ok) {
          setBulkError(await getErrorMessage(response, "Move failed"));
          return;
        }

        movedAssetIds.add(asset.id);
      }

      if (bulkMoveTarget === selectedFolderPath) {
        setOptimisticAssets((currentAssets) =>
          currentAssets.map((asset) =>
            movedAssetIds.has(asset.id)
              ? { ...asset, folderPath: bulkMoveTarget }
              : asset
          )
        );
      } else {
        setOptimisticAssets((currentAssets) =>
          currentAssets.filter((asset) => !movedAssetIds.has(asset.id))
        );
        setSelectedAssetIds((currentIds) => {
          const nextIds = new Set(currentIds);

          for (const assetId of movedAssetIds) {
            nextIds.delete(assetId);
          }

          return nextIds;
        });
      }

      router.refresh();
    });
  };
  const moveAsset = async (assetId: string, folderPath: string) => {
    const asset = optimisticAssets.find(
      (currentAsset) => currentAsset.id === assetId
    );

    if (!(asset && folderPath !== asset.folderPath)) {
      return;
    }

    setMoveError(null);
    const response = await fetch(`/api/assets/${assetId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ folderPath }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      setMoveError(payload?.error ?? "Move failed");
      return;
    }

    if (folderPath === selectedFolderPath) {
      handleAssetUpdated({ ...asset, folderPath });
    } else {
      handleDeleted(assetId);
    }

    router.refresh();
  };
  const moveDraggedAssets = async (assetId: string, folderPath: string) => {
    const assetIds =
      selectedAssetIds.has(assetId) && selectedAssetIds.size > 1
        ? [...selectedAssetIds]
        : [assetId];

    for (const currentAssetId of assetIds) {
      await moveAsset(currentAssetId, folderPath);
    }
  };
  const uploadDroppedFiles = useCallback(
    async (files: File[], folderPath = selectedFolderPath) => {
      if (!(files.length && workspaceId) || isDropUploading) {
        return;
      }

      setDropError(null);
      setDropProgress(1);
      setDropUploadLabel(
        `${files.length} file${files.length === 1 ? "" : "s"}`
      );
      setIsDropUploading(true);

      try {
        await uploadFilesSequentially({
          cdnEnabled: false,
          files,
          folderPath,
          onFileStart: (file) => setDropUploadLabel(file.name),
          onProgress: setDropProgress,
          workspaceId,
        });
        setDragDepth(0);
        setDropProgress(0);
        setDropUploadLabel(null);
        setIsDropUploading(false);
        router.refresh();
      } catch (uploadError) {
        setDropError(
          uploadError instanceof Error ? uploadError.message : "Upload failed"
        );
        setDropProgress(0);
        setIsDropUploading(false);
      }
    },
    [isDropUploading, router, selectedFolderPath, workspaceId]
  );

  useEffect(() => {
    let nextDragDepth = 0;

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFilesTransfer(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      nextDragDepth += 1;
      setDragDepth(nextDragDepth);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFilesTransfer(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      nextDragDepth = Math.max(0, nextDragDepth - 1);
      setDragDepth(nextDragDepth);
    };

    const handleDragOver = (event: DragEvent) => {
      const { dataTransfer } = event;

      if (!hasFilesTransfer(dataTransfer)) {
        return;
      }

      event.preventDefault();
      dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (event: DragEvent) => {
      if (!hasFilesTransfer(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      nextDragDepth = 0;
      setDragDepth(0);

      const files = Array.from(event.dataTransfer?.files ?? []);
      uploadDroppedFiles(files).catch((uploadError: unknown) => {
        setDropError(
          uploadError instanceof Error ? uploadError.message : "Upload failed"
        );
        setIsDropUploading(false);
      });
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [uploadDroppedFiles]);

  const isDraggingFiles = dragDepth > 0;
  const draggedAsset = draggedAssetId
    ? optimisticAssets.find((asset) => asset.id === draggedAssetId)
    : null;
  const moveFolderOptions = allFolders.filter(
    (folder) => folder.path !== rootFolderPath
  );
  const moveTargets = draggedAsset
    ? [
        { id: rootFolderPath, name: "Main", path: rootFolderPath },
        ...moveFolderOptions,
      ].filter((folder) => folder.path !== draggedAsset.folderPath)
    : [];

  return (
    <div className="relative grid gap-4 lg:grid-cols-[minmax(420px,1fr)_minmax(360px,520px)]">
      {isDraggingFiles || isDropUploading ? (
        <div className="pointer-events-none fixed inset-0 z-50 border-2 border-primary border-dashed bg-primary/5 p-4 backdrop-blur-[1px]">
          <div className="mx-auto mt-6 flex max-w-md items-center gap-3 rounded-md border bg-popover/95 px-3 py-2 shadow-sm">
            <CloudUploadIcon className="size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">
                {isDropUploading
                  ? "Uploading files"
                  : "Drop anywhere to upload"}
              </div>
              <div className="truncate text-muted-foreground text-xs">
                {dropUploadLabel ??
                  `Files will be added to ${selectedFolderPath}`}
              </div>
            </div>
          </div>
          {dropProgress > 0 ? (
            <Progress className="mx-auto mt-3 max-w-md" value={dropProgress} />
          ) : null}
        </div>
      ) : null}
      {moveTargets.length ? (
        <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap gap-2 rounded-t-lg border-primary/40 border-x border-t bg-background/95 p-2 shadow-sm">
          {moveTargets.map((folder) => (
            <button
              className="rounded-md border bg-background px-2 py-1 text-muted-foreground text-xs hover:border-primary/50 hover:text-foreground"
              key={folder.path}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedAssetId) {
                  moveDraggedAssets(draggedAssetId, folder.path).catch(
                    (moveErrorValue: unknown) => {
                      setMoveError(
                        moveErrorValue instanceof Error
                          ? moveErrorValue.message
                          : "Move failed"
                      );
                    }
                  );
                }
                setDraggedAssetId(null);
              }}
              type="button"
            >
              {folder.name}
            </button>
          ))}
        </div>
      ) : null}
      {isDropUploading ? (
        <div className="sr-only" role="status">
          Uploading files
        </div>
      ) : null}
      {dropError ? (
        <div className="absolute -top-8 right-0 text-destructive text-xs">
          {dropError}
        </div>
      ) : null}
      {moveError ? (
        <div className="absolute -top-8 left-0 text-destructive text-xs">
          {moveError}
        </div>
      ) : null}
      <div className="min-h-96 overflow-x-auto rounded-lg border">
        <div className="flex flex-col gap-2 border-b px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm">Files</div>
              <div className="truncate text-muted-foreground text-xs">
                {selectedFolderPath}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search files and folders"
                  className="h-7 w-48 pl-7 text-xs"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search"
                  value={searchQuery}
                />
              </div>
              <FolderCreateDialog
                parentPath={selectedFolderPath}
                tooltip="Create new folder in the current location"
                workspaceId={workspaceId}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-pressed={selectMode}
                      onClick={toggleSelectMode}
                      type="button"
                      variant={selectMode ? "secondary" : "outline"}
                    >
                      {selectMode ? <XIcon /> : <CheckSquareIcon />}
                      {selectMode ? "Done" : "Select"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {selectMode ? "Exit selection mode" : "Select files"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          {selectMode ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Checkbox
                  aria-label="Select all visible files"
                  checked={
                    filteredAssets.length > 0 &&
                    filteredAssets.every((asset) =>
                      selectedAssetIds.has(asset.id)
                    )
                  }
                  onCheckedChange={(checked) =>
                    toggleAllVisibleAssets(checked === true)
                  }
                />
                {selectedCount} selected
              </div>
              <Button
                disabled={!publishableSelectedAssets.length || isBulkPending}
                onClick={publishSelectedAssets}
                type="button"
              >
                <Globe2Icon />
                Publish {publishableSelectedAssets.length || ""}
              </Button>
              <Select onValueChange={setBulkMoveTarget} value={bulkMoveTarget}>
                <SelectTrigger aria-label="Move selected files to folder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={rootFolderPath}>Main</SelectItem>
                  {moveFolderOptions.map((folder) => (
                    <SelectItem key={folder.path} value={folder.path}>
                      {folder.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!selectedCount || isBulkPending}
                onClick={moveSelectedAssets}
                type="button"
                variant="outline"
              >
                <FolderInputIcon />
                Move
              </Button>
              {bulkError ? (
                <span className="text-destructive text-xs">{bulkError}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {selectMode ? (
                <TableHead className="w-9">
                  <span className="sr-only">Select</span>
                </TableHead>
              ) : null}
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>CDN</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hasFileManagerItems ? (
              <>
                {filteredFolders.map((folder) => (
                  <FolderTableRowClient
                    folderHref={
                      folder.path === "asset"
                        ? "/"
                        : `/?folder=${encodeURIComponent(folder.path)}`
                    }
                    folderName={folder.name}
                    folderPath={folder.path}
                    key={folder.id}
                    onAssetDrop={(folderPath) => {
                      if (!draggedAssetId) {
                        return;
                      }

                      moveDraggedAssets(draggedAssetId, folderPath).catch(
                        (moveErrorValue: unknown) => {
                          setMoveError(
                            moveErrorValue instanceof Error
                              ? moveErrorValue.message
                              : "Move failed"
                          );
                        }
                      );
                      setDraggedAssetId(null);
                    }}
                    onFileDrop={(folderPath, files) => {
                      uploadDroppedFiles(files, folderPath).catch(
                        (uploadError: unknown) => {
                          setDropError(
                            uploadError instanceof Error
                              ? uploadError.message
                              : "Upload failed"
                          );
                          setIsDropUploading(false);
                        }
                      );
                    }}
                    selectMode={selectMode}
                    workspaceId={workspaceId}
                  />
                ))}
                {filteredAssets.map((asset) => {
                  const { downloadUrl, previewUrl } = getAssetUrls(asset);
                  const cdnState = getAssetCdnState(asset);

                  return (
                    <AssetTableRowClient
                      assetId={asset.id}
                      cdnLabel={cdnState.label}
                      cdnVariant={cdnState.variant}
                      downloadUrl={downloadUrl}
                      filename={asset.filename}
                      href={assetHref({
                        assetId: asset.id,
                        folderPath: selectedFolderPath,
                      })}
                      key={asset.id}
                      mimeType={asset.mimeType}
                      onBulkSelect={handleBulkSelect}
                      onDeleted={handleDeleted}
                      onDragEnd={() => setDraggedAssetId(null)}
                      onDragStart={setDraggedAssetId}
                      onOpen={() => {
                        setActiveAssetId(asset.id);
                        setIsRefreshingSelection(true);
                      }}
                      previewUrl={previewUrl}
                      selected={selectedAsset?.id === asset.id}
                      selectedForBulk={selectedAssetIds.has(asset.id)}
                      selectMode={selectMode}
                      sizeLabel={formatBytes(asset.sizeBytes)}
                    />
                  );
                })}
              </>
            ) : (
              <TableRow>
                <TableCell
                  className="h-32 text-center text-muted-foreground text-sm"
                  colSpan={tableColumnCount}
                >
                  {searchQuery.trim()
                    ? "No files or folders match this search."
                    : "This folder is empty."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <AssetDetailsPanel
        asset={selectedAsset}
        isRefreshing={isRefreshingSelection}
        onAssetUpdated={handleAssetUpdated}
      />
    </div>
  );
};
// biome-ignore-end lint/complexity/noExcessiveCognitiveComplexity: End file-manager client surface suppression.
