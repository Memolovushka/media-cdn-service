"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { CloudUploadIcon, DownloadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AssetCdnControls } from "@/components/asset-cdn-controls";
import { AssetPreviewDialog } from "@/components/asset-preview-dialog";
import { uploadFilesSequentially } from "@/components/asset-upload-client";
import {
  AssetTableRowClient,
  FolderTableRowClient,
} from "@/components/file-manager-table-rows";

interface DashboardAssetVersion {
  id: string;
  publicUrl: null | string;
  uploadStatus: string;
}

export interface DashboardAsset {
  cdnEnabled: boolean;
  filename: string;
  id: string;
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  versions: DashboardAssetVersion[];
  workspaceId: string;
}

export interface DashboardFolder {
  id: string;
  name: string;
  path: string;
}

const bytesPerUnit = 1024;

const assetStatusLabels = {
  abandoned: "Abandoned",
  failed: "Failed",
  pending: "Pending upload",
  ready: "Ready",
  uploaded: "Processing",
} as const;

const assetStatusVariants = {
  abandoned: "outline",
  failed: "destructive",
  pending: "secondary",
  ready: "default",
  uploaded: "secondary",
} as const;

type AssetStatus = keyof typeof assetStatusLabels;

const getAssetStatusLabel = (status?: string) =>
  status && status in assetStatusLabels
    ? assetStatusLabels[status as AssetStatus]
    : assetStatusLabels.pending;

const getAssetStatusVariant = (status?: string) =>
  status && status in assetStatusVariants
    ? assetStatusVariants[status as AssetStatus]
    : assetStatusVariants.pending;

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
}: {
  asset?: DashboardAsset | null;
  isRefreshing: boolean;
}) => {
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

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{asset.filename}</div>
          <div className="mt-1 truncate text-muted-foreground text-xs">
            {asset.mimeType} - {formatBytes(asset.sizeBytes)}
          </div>
        </div>
        <Badge variant={getAssetStatusVariant(latestVersion?.uploadStatus)}>
          {getAssetStatusLabel(latestVersion?.uploadStatus)}
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        <AssetPreviewDialog
          disabled={!previewUrl}
          filename={asset.filename}
          mimeType={asset.mimeType}
          previewUrl={previewUrl}
        />
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
        tags={asset.tags}
        workspaceId={asset.workspaceId}
      />
    </section>
  );
};

export const FileManager = ({
  assets,
  selectedAssetId,
  selectedFolderPath,
  visibleFolders,
  workspaceId,
}: {
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
  const [isDropUploading, setIsDropUploading] = useState(false);
  const [isRefreshingSelection, setIsRefreshingSelection] = useState(false);

  useEffect(() => {
    setOptimisticAssets(assets);
    setActiveAssetId(selectedAssetId || assets.at(0)?.id || "");
    setIsRefreshingSelection(false);
  }, [assets, selectedAssetId]);

  const selectedAsset = useMemo(
    () =>
      optimisticAssets.find((asset) => asset.id === activeAssetId) ??
      optimisticAssets.at(0) ??
      null,
    [activeAssetId, optimisticAssets]
  );
  const hasFileManagerItems = Boolean(
    visibleFolders.length || optimisticAssets.length
  );

  const handleDeleted = (assetId: string) => {
    setOptimisticAssets((currentAssets) => {
      const nextAssets = currentAssets.filter((asset) => asset.id !== assetId);

      if (activeAssetId === assetId) {
        setActiveAssetId(nextAssets.at(0)?.id || "");
      }

      return nextAssets;
    });
  };
  const uploadDroppedFiles = async (files: File[]) => {
    if (!(files.length && workspaceId) || isDropUploading) {
      return;
    }

    setDropError(null);
    setDropProgress(1);
    setDropUploadLabel(`${files.length} file${files.length === 1 ? "" : "s"}`);
    setIsDropUploading(true);

    try {
      await uploadFilesSequentially({
        cdnEnabled: false,
        files,
        folderPath: selectedFolderPath,
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
  };
  const isDraggingFiles = dragDepth > 0;

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: This surface accepts OS file drops while preserving table semantics inside.
    // biome-ignore lint/a11y/noStaticElementInteractions: Drag-and-drop has no native semantic container that can wrap the file manager table.
    <div
      className="relative grid gap-4 lg:grid-cols-[minmax(420px,1fr)_minmax(360px,520px)]"
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) {
          return;
        }

        event.preventDefault();
        setDragDepth((currentDepth) => currentDepth + 1);
      }}
      onDragLeave={(event) => {
        if (!event.dataTransfer.types.includes("Files")) {
          return;
        }

        event.preventDefault();
        setDragDepth((currentDepth) => Math.max(0, currentDepth - 1));
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) {
          return;
        }

        event.preventDefault();
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) {
          return;
        }

        event.preventDefault();
        setDragDepth(0);
        uploadDroppedFiles(Array.from(event.dataTransfer.files)).catch(
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
    >
      {isDraggingFiles || isDropUploading ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-primary border-dashed bg-background/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border bg-popover p-4 text-center shadow-sm">
            <CloudUploadIcon className="mx-auto size-8 text-primary" />
            <div className="mt-3 font-medium text-sm">
              {isDropUploading ? "Uploading files" : "Drop files to upload"}
            </div>
            <div className="mt-1 truncate text-muted-foreground text-xs">
              {dropUploadLabel ?? "They will be added to this folder"}
            </div>
            {dropProgress > 0 ? (
              <Progress className="mt-3" value={dropProgress} />
            ) : null}
          </div>
        </div>
      ) : null}
      {dropError ? (
        <div className="absolute -top-8 right-0 text-destructive text-xs">
          {dropError}
        </div>
      ) : null}
      <div className="min-h-96 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hasFileManagerItems ? (
              <>
                {visibleFolders.map((folder) => (
                  <FolderTableRowClient
                    folderHref={
                      folder.path === "asset"
                        ? "/"
                        : `/?folder=${encodeURIComponent(folder.path)}`
                    }
                    folderName={folder.name}
                    folderPath={folder.path}
                    key={folder.id}
                    workspaceId={workspaceId}
                  />
                ))}
                {optimisticAssets.map((asset) => {
                  const { downloadUrl, latestVersion, previewUrl } =
                    getAssetUrls(asset);

                  return (
                    <AssetTableRowClient
                      assetId={asset.id}
                      downloadUrl={downloadUrl}
                      filename={asset.filename}
                      href={assetHref({
                        assetId: asset.id,
                        folderPath: selectedFolderPath,
                      })}
                      key={asset.id}
                      mimeType={asset.mimeType}
                      onDeleted={handleDeleted}
                      onOpen={() => {
                        setActiveAssetId(asset.id);
                        setIsRefreshingSelection(true);
                      }}
                      previewUrl={previewUrl}
                      selected={selectedAsset?.id === asset.id}
                      sizeLabel={formatBytes(asset.sizeBytes)}
                      statusLabel={getAssetStatusLabel(
                        latestVersion?.uploadStatus
                      )}
                      statusVariant={getAssetStatusVariant(
                        latestVersion?.uploadStatus
                      )}
                    />
                  );
                })}
              </>
            ) : (
              <TableRow>
                <TableCell
                  className="h-32 text-center text-muted-foreground text-sm"
                  colSpan={5}
                >
                  This folder is empty.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <AssetDetailsPanel
        asset={selectedAsset}
        isRefreshing={isRefreshingSelection}
      />
    </div>
  );
};
