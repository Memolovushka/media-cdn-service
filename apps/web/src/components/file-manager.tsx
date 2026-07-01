"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
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
  CloudUploadIcon,
  DownloadIcon,
  FileAudioIcon,
  FileImageIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon,
  FolderInputIcon,
  Globe2Icon,
  LayoutGridIcon,
  ListIcon,
  MousePointerClickIcon,
  SaveIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  type ComponentProps,
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
import { TooltipHint } from "@/components/tooltip-hint";

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

type SelectableItem =
  | { asset: DashboardAsset; id: string; kind: "asset" }
  | { folder: DashboardFolder; id: string; kind: "folder" };

type ViewMode = "grid" | "list";

const bytesPerUnit = 1024;
const rootFolderPath = "asset";
const defaultTableColumnCount = 5;

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

const getAssetItemId = (assetId: string) => `asset:${assetId}`;
const getFolderItemId = (folderPath: string) => `folder:${folderPath}`;

const getNextSelectedItemIds = ({
  currentIds,
  itemId,
  items,
  lastSelectedItemId,
  shiftKey,
  shouldSelect,
}: {
  currentIds: Set<string>;
  itemId: string;
  items: SelectableItem[];
  lastSelectedItemId: null | string;
  shiftKey: boolean;
  shouldSelect: boolean;
}) => {
  const nextIds = new Set(currentIds);
  const currentIndex = items.findIndex((item) => item.id === itemId);
  const lastIndex = lastSelectedItemId
    ? items.findIndex((item) => item.id === lastSelectedItemId)
    : -1;

  if (!(shiftKey && lastIndex >= 0 && currentIndex >= 0)) {
    if (shouldSelect) {
      nextIds.add(itemId);
    } else {
      nextIds.delete(itemId);
    }

    return nextIds;
  }

  const [startIndex, endIndex] =
    lastIndex < currentIndex
      ? [lastIndex, currentIndex]
      : [currentIndex, lastIndex];

  for (const item of items.slice(startIndex, endIndex + 1)) {
    if (shouldSelect) {
      nextIds.add(item.id);
    } else {
      nextIds.delete(item.id);
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
const isAudioMimeType = (mimeType: string) => mimeType.startsWith("audio/");
const isVideoMimeType = (mimeType: string) => mimeType.startsWith("video/");
const isPdfMimeType = (mimeType: string) => mimeType === "application/pdf";
const isTextMimeType = (mimeType: string) => mimeType.startsWith("text/");

const getAssetTypeIcon = (mimeType: string) => {
  if (isImageMimeType(mimeType)) {
    return FileImageIcon;
  }

  if (isVideoMimeType(mimeType)) {
    return FileVideoIcon;
  }

  if (isAudioMimeType(mimeType)) {
    return FileAudioIcon;
  }

  return FileTextIcon;
};

const getAssetPreviewLabel = (mimeType: string) => {
  if (isImageMimeType(mimeType)) {
    return "Image preview";
  }

  if (isVideoMimeType(mimeType)) {
    return "Video preview";
  }

  if (isAudioMimeType(mimeType)) {
    return "Audio preview";
  }

  if (isPdfMimeType(mimeType)) {
    return "PDF preview";
  }

  if (isTextMimeType(mimeType)) {
    return "Text preview";
  }

  return "File preview";
};

const getGridCardClassName = ({
  selected,
  selectedForBulk,
}: {
  selected: boolean;
  selectedForBulk: boolean;
}) => {
  if (selectedForBulk) {
    return "border-primary bg-primary/15 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.22)]";
  }

  if (selected) {
    return "border-primary/70 bg-primary/10";
  }

  return "border-border bg-background";
};

const assetHref = ({
  assetId,
  folderPath,
  workspaceId,
}: {
  assetId: string;
  folderPath: string;
  workspaceId: string;
}) => {
  const params = new URLSearchParams();

  params.set("workspace", workspaceId);

  if (folderPath) {
    params.set("folder", folderPath);
  }

  params.set("asset", assetId);

  return `/?${params.toString()}`;
};

const AssetDetailsPanelSkeleton = () => (
  <section className="flex flex-col gap-4 rounded-lg border p-4">
    <Skeleton className="h-64 w-full rounded-md" />
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

const AssetPreviewSurface = ({
  asset,
  className,
  isReady,
  previewUrl,
}: {
  asset: DashboardAsset;
  className?: string;
  isReady: boolean;
  previewUrl: null | string;
}) => {
  const previewLabel = getAssetPreviewLabel(asset.mimeType);

  if (!(isReady && previewUrl)) {
    const AssetIcon = getAssetTypeIcon(asset.mimeType);

    return (
      <div
        className={`flex min-h-56 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/20 p-4 text-center text-muted-foreground text-sm ${className ?? ""}`}
      >
        <AssetIcon className="size-8" />
        Preview is available after upload finishes.
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-64 items-center justify-center overflow-hidden rounded-lg border bg-muted/20 ${className ?? ""}`}
    >
      <object
        aria-label={`Preview of ${asset.filename}`}
        className="h-full max-h-[460px] min-h-64 w-full object-contain"
        data={previewUrl}
        type={asset.mimeType}
      >
        <div className="flex min-h-56 items-center justify-center p-4 text-center text-muted-foreground text-sm">
          {previewLabel} is not available for this file.
        </div>
      </object>
    </div>
  );
};

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
      <AssetPreviewSurface
        asset={asset}
        isReady={isReady}
        previewUrl={previewUrl}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <TooltipHint content="Rename this file">
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
            </TooltipHint>
            <TooltipHint content="Save filename">
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
            </TooltipHint>
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

      <div className="flex items-center gap-1">
        {downloadUrl ? (
          <TooltipHint content="Download private file">
            <Button asChild size="icon" variant="ghost">
              <a href={downloadUrl}>
                <DownloadIcon />
                <span className="sr-only">Download</span>
              </a>
            </Button>
          </TooltipHint>
        ) : (
          <TooltipHint content="Download is available after upload finishes">
            <Button disabled size="icon" variant="ghost">
              <DownloadIcon />
              <span className="sr-only">Download</span>
            </Button>
          </TooltipHint>
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

const FolderGridCard = ({
  folder,
  onAssetDrop,
  onBulkSelect,
  onDragEnd,
  onDragStart,
  onFileDrop,
  onOpen,
  selected,
  selectedForBulk,
  selectMode,
}: {
  folder: DashboardFolder;
  onAssetDrop: (folderPath: string) => void;
  onBulkSelect: (
    folderPath: string,
    shiftKey: boolean,
    shouldSelect: boolean
  ) => void;
  onDragEnd: () => void;
  onDragStart: (folderPath: string) => void;
  onFileDrop: (folderPath: string, files: File[]) => void;
  onOpen: (folderPath: string) => void;
  selected: boolean;
  selectedForBulk: boolean;
  selectMode: boolean;
}) => (
  <button
    aria-pressed={selected || selectedForBulk}
    className={`group flex min-h-36 flex-col rounded-lg border p-3 text-left transition hover:border-primary/50 hover:bg-muted/40 ${getGridCardClassName({ selected, selectedForBulk })}`}
    draggable
    onClick={(event) => {
      if (event.shiftKey) {
        event.preventDefault();
        onBulkSelect(folder.path, true, true);
        return;
      }

      if (selectMode) {
        onBulkSelect(folder.path, false, !selectedForBulk);
        return;
      }

      onOpen(folder.path);
    }}
    onDragEnd={onDragEnd}
    onDragOver={(event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = event.dataTransfer.types.includes("Files")
        ? "copy"
        : "move";
    }}
    onDragStart={(event) => {
      event.dataTransfer.effectAllowed = "move";
      onDragStart(folder.path);
    }}
    onDrop={(event) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.dataTransfer.types.includes("Files")) {
        const files = Array.from(event.dataTransfer.files);

        if (files.length) {
          onFileDrop(folder.path, files);
        }

        return;
      }

      onAssetDrop(folder.path);
    }}
    type="button"
  >
    <div className="flex flex-1 items-center justify-center rounded-md bg-muted/30">
      <FolderIcon className="size-11 text-muted-foreground transition group-hover:text-primary" />
    </div>
    <div className="mt-3 min-w-0">
      <div className="truncate font-medium text-sm">{folder.name}</div>
      <div className="truncate text-muted-foreground text-xs">Folder</div>
    </div>
  </button>
);

const AssetGridCard = ({
  asset,
  cdnLabel,
  cdnVariant,
  onBulkSelect,
  onDragEnd,
  onDragStart,
  onOpen,
  previewUrl,
  selected,
  selectedForBulk,
  selectMode,
  sizeLabel,
}: {
  asset: DashboardAsset;
  cdnLabel: string;
  cdnVariant: ComponentProps<typeof Badge>["variant"];
  onBulkSelect: (assetId: string, shiftKey: boolean, selected: boolean) => void;
  onDragEnd: () => void;
  onDragStart: (assetId: string) => void;
  onOpen: () => void;
  previewUrl: null | string;
  selected: boolean;
  selectedForBulk: boolean;
  selectMode: boolean;
  sizeLabel: string;
}) => {
  const AssetIcon = getAssetTypeIcon(asset.mimeType);
  const showImagePreview = previewUrl && isImageMimeType(asset.mimeType);

  return (
    <button
      aria-pressed={selected || selectedForBulk}
      className={`group flex min-h-44 flex-col rounded-lg border p-3 text-left transition hover:border-primary/50 hover:bg-muted/40 ${getGridCardClassName({ selected, selectedForBulk })}`}
      draggable
      onClick={(event) => {
        if (event.shiftKey) {
          event.preventDefault();
          onBulkSelect(asset.id, true, true);
          return;
        }

        if (selectMode) {
          onBulkSelect(asset.id, false, !selectedForBulk);
          return;
        }

        onOpen();
      }}
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart(asset.id);
      }}
      type="button"
    >
      <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-muted/30">
        {showImagePreview ? (
          <object
            aria-label={`Thumbnail of ${asset.filename}`}
            className="h-full w-full object-cover"
            data={previewUrl}
            type={asset.mimeType}
          >
            <AssetIcon className="size-10 text-muted-foreground" />
          </object>
        ) : (
          <AssetIcon className="size-10 text-muted-foreground transition group-hover:text-primary" />
        )}
      </div>
      <div className="mt-3 flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-sm">{asset.filename}</div>
          <div className="truncate text-muted-foreground text-xs">
            {asset.mimeType} - {sizeLabel}
          </div>
        </div>
        <Badge className="shrink-0" variant={cdnVariant}>
          {cdnLabel}
        </Badge>
      </div>
    </button>
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
  const [activeFolderPath, setActiveFolderPath] = useState("");
  const [dragDepth, setDragDepth] = useState(0);
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropProgress, setDropProgress] = useState(0);
  const [dropUploadLabel, setDropUploadLabel] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [isDropUploading, setIsDropUploading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isRefreshingSelection, setIsRefreshingSelection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set()
  );
  const [lastSelectedItemId, setLastSelectedItemId] = useState<string | null>(
    null
  );
  const [bulkMoveTarget, setBulkMoveTarget] = useState(rootFolderPath);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isBulkPending, startBulkTransition] = useTransition();

  useEffect(() => {
    setOptimisticAssets(assets);
    const nextActiveAssetId = selectedAssetId || assets.at(0)?.id || "";

    setActiveAssetId(nextActiveAssetId);
    setActiveFolderPath("");
    setIsRefreshingSelection(false);
    setSelectedItemIds(new Set());
    setLastSelectedItemId((currentAnchorId) => {
      if (
        currentAnchorId &&
        assets.some((asset) => getAssetItemId(asset.id) === currentAnchorId)
      ) {
        return currentAnchorId;
      }

      return nextActiveAssetId ? getAssetItemId(nextActiveAssetId) : null;
    });
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
  const filteredItems = useMemo<SelectableItem[]>(
    () => [
      ...filteredFolders.map((folder) => ({
        folder,
        id: getFolderItemId(folder.path),
        kind: "folder" as const,
      })),
      ...filteredAssets.map((asset) => ({
        asset,
        id: getAssetItemId(asset.id),
        kind: "asset" as const,
      })),
    ],
    [filteredAssets, filteredFolders]
  );
  const selectedAssets = useMemo(
    () =>
      optimisticAssets.filter((asset) =>
        selectedItemIds.has(getAssetItemId(asset.id))
      ),
    [optimisticAssets, selectedItemIds]
  );
  const selectedFolders = useMemo(
    () =>
      allFolders.filter((folder) =>
        selectedItemIds.has(getFolderItemId(folder.path))
      ),
    [allFolders, selectedItemIds]
  );
  const publishableSelectedAssets = selectedAssets.filter(
    (asset) => isAssetReady(asset) && !isAssetPublished(asset)
  );
  const hasFileManagerItems = Boolean(
    filteredFolders.length || filteredAssets.length
  );
  const tableColumnCount = defaultTableColumnCount;
  const selectedCount = selectedItemIds.size;
  const allVisibleItemsSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedItemIds.has(item.id));

  const handleDeleted = (assetId: string) => {
    setSelectedItemIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(getAssetItemId(assetId));
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
    itemId: string,
    shiftKey: boolean,
    shouldSelect: boolean
  ) => {
    if (shiftKey) {
      setSelectMode(true);
    }

    setSelectedItemIds((currentIds) =>
      getNextSelectedItemIds({
        currentIds,
        itemId,
        items: filteredItems,
        lastSelectedItemId,
        shiftKey,
        shouldSelect,
      })
    );
    setLastSelectedItemId(itemId);
  };
  const toggleSelectMode = () => {
    setSelectMode((currentMode) => {
      const nextMode = !currentMode;

      if (!nextMode) {
        setSelectedItemIds(new Set());
        setLastSelectedItemId(null);
      }

      return nextMode;
    });
  };
  const clearSelection = () => {
    if (!selectedItemIds.size) {
      return;
    }

    setSelectedItemIds(new Set());
    setSelectMode(false);
    setLastSelectedItemId(null);
  };
  const toggleAllVisibleAssets = (checked: boolean) => {
    setSelectedItemIds((currentIds) => {
      const nextIds = new Set(currentIds);

      for (const item of filteredItems) {
        if (checked) {
          nextIds.add(item.id);
        } else {
          nextIds.delete(item.id);
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
  const isFolderInsideFolder = (path: string, parentPath: string) =>
    path === parentPath || path.startsWith(`${parentPath}/`);
  const isInsideSelectedFolder = (path: string, folders: DashboardFolder[]) =>
    folders.some((folder) => isFolderInsideFolder(path, folder.path));
  const moveSelectedItems = () => {
    if (!(selectedCount && bulkMoveTarget) || isBulkPending) {
      return;
    }

    const foldersToMove = selectedFolders.filter(
      (folder) =>
        !selectedFolders.some(
          (selectedFolder) =>
            selectedFolder.path !== folder.path &&
            isFolderInsideFolder(folder.path, selectedFolder.path)
        )
    );
    const assetsToMove = selectedAssets.filter(
      (asset) => !isInsideSelectedFolder(asset.folderPath, foldersToMove)
    );

    if (
      foldersToMove.some((folder) =>
        isFolderInsideFolder(bulkMoveTarget, folder.path)
      )
    ) {
      setBulkError("Folder cannot be moved into itself");
      return;
    }

    setBulkError(null);
    startBulkTransition(async () => {
      const movedItemIds = new Set<string>();

      for (const folder of foldersToMove) {
        if (folder.path === bulkMoveTarget) {
          continue;
        }

        const response = await fetch("/api/folders", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            path: folder.path,
            targetParentPath: bulkMoveTarget,
            workspaceId,
          }),
        });

        if (!response.ok) {
          setBulkError(await getErrorMessage(response, "Move failed"));
          return;
        }

        movedItemIds.add(getFolderItemId(folder.path));
      }

      for (const asset of assetsToMove) {
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

        movedItemIds.add(getAssetItemId(asset.id));
      }

      if (bulkMoveTarget === selectedFolderPath) {
        setOptimisticAssets((currentAssets) =>
          currentAssets.map((asset) =>
            movedItemIds.has(getAssetItemId(asset.id))
              ? { ...asset, folderPath: bulkMoveTarget }
              : asset
          )
        );
      } else {
        setOptimisticAssets((currentAssets) =>
          currentAssets.filter(
            (asset) => !movedItemIds.has(getAssetItemId(asset.id))
          )
        );
        setSelectedItemIds((currentIds) => {
          const nextIds = new Set(currentIds);

          for (const itemId of movedItemIds) {
            nextIds.delete(itemId);
          }

          return nextIds;
        });
      }

      router.refresh();
    });
  };
  const moveFolder = async (folderPath: string, targetParentPath: string) => {
    if (
      folderPath === targetParentPath ||
      targetParentPath.startsWith(`${folderPath}/`)
    ) {
      setMoveError("Folder cannot be moved into itself");
      return;
    }

    setMoveError(null);
    const response = await fetch("/api/folders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: folderPath,
        targetParentPath,
        workspaceId,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      setMoveError(payload?.error ?? "Move failed");
      return;
    }

    setSelectedItemIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(getFolderItemId(folderPath));
      return nextIds;
    });
    router.refresh();
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
  const moveDraggedItems = async (itemId: string, folderPath: string) => {
    const itemIds =
      selectedItemIds.has(itemId) && selectedItemIds.size > 1
        ? [...selectedItemIds]
        : [itemId];
    const selectedFolderPaths = itemIds
      .filter((currentItemId) => currentItemId.startsWith("folder:"))
      .map((currentItemId) => currentItemId.slice("folder:".length));

    for (const currentItemId of itemIds) {
      if (currentItemId.startsWith("folder:")) {
        const currentFolderPath = currentItemId.slice("folder:".length);

        if (
          selectedFolderPaths.some(
            (selectedFolderPath) =>
              selectedFolderPath !== currentFolderPath &&
              isFolderInsideFolder(currentFolderPath, selectedFolderPath)
          )
        ) {
          continue;
        }

        await moveFolder(currentFolderPath, folderPath);
        continue;
      }

      const currentAssetId = currentItemId.slice("asset:".length);
      const asset = optimisticAssets.find(
        (currentAsset) => currentAsset.id === currentAssetId
      );

      if (
        asset &&
        selectedFolderPaths.some((selectedFolderPath) =>
          isFolderInsideFolder(asset.folderPath, selectedFolderPath)
        )
      ) {
        continue;
      }

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
  const moveFolderOptions = allFolders.filter(
    (folder) => folder.path !== rootFolderPath
  );
  const draggedFolderPaths = draggedItemId
    ? (selectedItemIds.has(draggedItemId) && selectedItemIds.size > 1
        ? [...selectedItemIds]
        : [draggedItemId]
      )
        .filter((itemId) => itemId.startsWith("folder:"))
        .map((itemId) => itemId.slice("folder:".length))
    : [];
  const draggedAsset = draggedItemId?.startsWith("asset:")
    ? optimisticAssets.find(
        (asset) => getAssetItemId(asset.id) === draggedItemId
      )
    : null;
  const moveTargets = draggedItemId
    ? [
        { id: rootFolderPath, name: "Main", path: rootFolderPath },
        ...moveFolderOptions,
      ].filter(
        (folder) =>
          folder.path !== draggedAsset?.folderPath &&
          !draggedFolderPaths.some((folderPath) =>
            isFolderInsideFolder(folder.path, folderPath)
          )
      )
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
                if (draggedItemId) {
                  moveDraggedItems(draggedItemId, folder.path).catch(
                    (moveErrorValue: unknown) => {
                      setMoveError(
                        moveErrorValue instanceof Error
                          ? moveErrorValue.message
                          : "Move failed"
                      );
                    }
                  );
                }
                setDraggedItemId(null);
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
      <div className="flex min-h-96 flex-col overflow-x-auto rounded-lg border">
        <div className="flex flex-col gap-2 border-b px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm">Files</div>
              <div className="truncate text-muted-foreground text-xs">
                {selectedFolderPath}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {isSearchOpen || searchQuery ? (
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search files and folders"
                    autoFocus
                    className="h-7 w-36 pr-7 pl-7 text-xs"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setSearchQuery("");
                        setIsSearchOpen(false);
                      }
                    }}
                    placeholder="Search"
                    value={searchQuery}
                  />
                  <TooltipHint content="Clear search">
                    <Button
                      aria-label="Close search"
                      className="absolute top-1 right-1 size-5"
                      onClick={() => {
                        setSearchQuery("");
                        setIsSearchOpen(false);
                      }}
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                    >
                      <XIcon />
                    </Button>
                  </TooltipHint>
                </div>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label="Search files and folders"
                        onClick={() => setIsSearchOpen(true)}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <SearchIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Search files and folders</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <FolderCreateDialog
                parentPath={selectedFolderPath}
                tooltip="Create new folder in the current location"
                workspaceId={workspaceId}
              />
              <div className="flex rounded-md border bg-background p-0.5">
                <TooltipHint content="List view">
                  <Button
                    aria-label="Show files as a list"
                    aria-pressed={viewMode === "list"}
                    onClick={() => setViewMode("list")}
                    size="icon-xs"
                    type="button"
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                  >
                    <ListIcon />
                  </Button>
                </TooltipHint>
                <TooltipHint content="Grid view">
                  <Button
                    aria-label="Show files as a grid"
                    aria-pressed={viewMode === "grid"}
                    onClick={() => setViewMode("grid")}
                    size="icon-xs"
                    type="button"
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                  >
                    <LayoutGridIcon />
                  </Button>
                </TooltipHint>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-pressed={selectMode}
                      onClick={toggleSelectMode}
                      type="button"
                      variant={selectMode ? "secondary" : "outline"}
                    >
                      {selectMode ? <XIcon /> : <MousePointerClickIcon />}
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
                <TooltipHint
                  content={
                    allVisibleItemsSelected
                      ? "Clear visible selection"
                      : "Select all visible items"
                  }
                >
                  <Button
                    aria-label={
                      allVisibleItemsSelected
                        ? "Clear visible selection"
                        : "Select all visible items"
                    }
                    onClick={() =>
                      toggleAllVisibleAssets(!allVisibleItemsSelected)
                    }
                    size="icon-xs"
                    type="button"
                    variant={allVisibleItemsSelected ? "secondary" : "ghost"}
                  >
                    {allVisibleItemsSelected ? (
                      <XIcon />
                    ) : (
                      <MousePointerClickIcon />
                    )}
                  </Button>
                </TooltipHint>
                {selectedCount} selected
              </div>
              <TooltipHint content="Publish selected ready files to CDN">
                <Button
                  disabled={!publishableSelectedAssets.length || isBulkPending}
                  onClick={publishSelectedAssets}
                  type="button"
                >
                  <Globe2Icon />
                  Publish {publishableSelectedAssets.length || ""}
                </Button>
              </TooltipHint>
              <Select onValueChange={setBulkMoveTarget} value={bulkMoveTarget}>
                <TooltipHint content="Choose target folder">
                  <SelectTrigger aria-label="Move selected items to folder">
                    <SelectValue />
                  </SelectTrigger>
                </TooltipHint>
                <SelectContent>
                  <SelectItem value={rootFolderPath}>Main</SelectItem>
                  {moveFolderOptions.map((folder) => (
                    <SelectItem key={folder.path} value={folder.path}>
                      {folder.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <TooltipHint content="Move selected files to the chosen folder">
                <Button
                  disabled={!selectedCount || isBulkPending}
                  onClick={moveSelectedItems}
                  type="button"
                  variant="outline"
                >
                  <FolderInputIcon />
                  Move
                </Button>
              </TooltipHint>
              {bulkError ? (
                <span className="text-destructive text-xs">{bulkError}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {viewMode === "list" ? (
          <Table>
            <TableHeader>
              <TableRow>
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
                      folderHref={`/?${new URLSearchParams({
                        ...(folder.path === "asset"
                          ? {}
                          : { folder: folder.path }),
                        workspace: workspaceId,
                      }).toString()}`}
                      folderName={folder.name}
                      folderPath={folder.path}
                      key={folder.id}
                      onAssetDrop={(folderPath) => {
                        if (!draggedItemId) {
                          return;
                        }

                        moveDraggedItems(draggedItemId, folderPath).catch(
                          (moveErrorValue: unknown) => {
                            setMoveError(
                              moveErrorValue instanceof Error
                                ? moveErrorValue.message
                                : "Move failed"
                            );
                          }
                        );
                        setDraggedItemId(null);
                      }}
                      onBulkSelect={(folderPath, shiftKey, shouldSelect) =>
                        handleBulkSelect(
                          getFolderItemId(folderPath),
                          shiftKey,
                          shouldSelect
                        )
                      }
                      onDragEnd={() => setDraggedItemId(null)}
                      onDragStart={(folderPath) =>
                        setDraggedItemId(getFolderItemId(folderPath))
                      }
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
                      onOpen={(folderPath) => {
                        setActiveFolderPath(folderPath);
                        setLastSelectedItemId(getFolderItemId(folderPath));
                      }}
                      selected={activeFolderPath === folder.path}
                      selectedForBulk={selectedItemIds.has(
                        getFolderItemId(folder.path)
                      )}
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
                          workspaceId,
                        })}
                        key={asset.id}
                        mimeType={asset.mimeType}
                        onBulkSelect={(assetId, shiftKey, shouldSelect) =>
                          handleBulkSelect(
                            getAssetItemId(assetId),
                            shiftKey,
                            shouldSelect
                          )
                        }
                        onDeleted={handleDeleted}
                        onDragEnd={() => setDraggedItemId(null)}
                        onDragStart={(assetId) =>
                          setDraggedItemId(getAssetItemId(assetId))
                        }
                        onOpen={() => {
                          setActiveAssetId(asset.id);
                          setLastSelectedItemId(getAssetItemId(asset.id));
                          setIsRefreshingSelection(true);
                        }}
                        previewUrl={previewUrl}
                        selected={selectedAsset?.id === asset.id}
                        selectedForBulk={selectedItemIds.has(
                          getAssetItemId(asset.id)
                        )}
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
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {hasFileManagerItems ? (
              <>
                {filteredFolders.map((folder) => (
                  <FolderGridCard
                    folder={folder}
                    key={folder.id}
                    onAssetDrop={(folderPath) => {
                      if (!draggedItemId) {
                        return;
                      }

                      moveDraggedItems(draggedItemId, folderPath).catch(
                        (moveErrorValue: unknown) => {
                          setMoveError(
                            moveErrorValue instanceof Error
                              ? moveErrorValue.message
                              : "Move failed"
                          );
                        }
                      );
                      setDraggedItemId(null);
                    }}
                    onBulkSelect={(folderPath, shiftKey, shouldSelect) =>
                      handleBulkSelect(
                        getFolderItemId(folderPath),
                        shiftKey,
                        shouldSelect
                      )
                    }
                    onDragEnd={() => setDraggedItemId(null)}
                    onDragStart={(folderPath) =>
                      setDraggedItemId(getFolderItemId(folderPath))
                    }
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
                    onOpen={(folderPath) => {
                      setActiveFolderPath(folderPath);
                      setLastSelectedItemId(getFolderItemId(folderPath));
                      router.push(
                        `/?${new URLSearchParams({
                          ...(folderPath === "asset"
                            ? {}
                            : { folder: folderPath }),
                          workspace: workspaceId,
                        }).toString()}`
                      );
                    }}
                    selected={activeFolderPath === folder.path}
                    selectedForBulk={selectedItemIds.has(
                      getFolderItemId(folder.path)
                    )}
                    selectMode={selectMode}
                  />
                ))}
                {filteredAssets.map((asset) => {
                  const { previewUrl } = getAssetUrls(asset);
                  const cdnState = getAssetCdnState(asset);

                  return (
                    <AssetGridCard
                      asset={asset}
                      cdnLabel={cdnState.label}
                      cdnVariant={cdnState.variant}
                      key={asset.id}
                      onBulkSelect={(assetId, shiftKey, shouldSelect) =>
                        handleBulkSelect(
                          getAssetItemId(assetId),
                          shiftKey,
                          shouldSelect
                        )
                      }
                      onDragEnd={() => setDraggedItemId(null)}
                      onDragStart={(assetId) =>
                        setDraggedItemId(getAssetItemId(assetId))
                      }
                      onOpen={() => {
                        setActiveAssetId(asset.id);
                        setLastSelectedItemId(getAssetItemId(asset.id));
                        setIsRefreshingSelection(true);
                        router.push(
                          assetHref({
                            assetId: asset.id,
                            folderPath: selectedFolderPath,
                            workspaceId,
                          }) as Route
                        );
                      }}
                      previewUrl={previewUrl}
                      selected={selectedAsset?.id === asset.id}
                      selectedForBulk={selectedItemIds.has(
                        getAssetItemId(asset.id)
                      )}
                      selectMode={selectMode}
                      sizeLabel={formatBytes(asset.sizeBytes)}
                    />
                  );
                })}
              </>
            ) : (
              <div className="col-span-full flex min-h-32 items-center justify-center text-center text-muted-foreground text-sm">
                {searchQuery.trim()
                  ? "No files or folders match this search."
                  : "This folder is empty."}
              </div>
            )}
          </div>
        )}
        <button
          aria-label="Clear selected items"
          className="min-h-12 flex-1 cursor-default bg-transparent"
          onClick={clearSelection}
          tabIndex={-1}
          type="button"
        />
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
