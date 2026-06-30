"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
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
import { CloudUploadIcon, DownloadIcon, SaveIcon } from "lucide-react";
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
  const handleAssetUpdated = (nextAsset: DashboardAsset) => {
    setOptimisticAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.id === nextAsset.id ? { ...asset, ...nextAsset } : asset
      )
    );
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
  const moveTargets = draggedAsset
    ? [
        { id: rootFolderPath, name: "Main", path: rootFolderPath },
        ...allFolders,
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
                  moveAsset(draggedAssetId, folder.path).catch(
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
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <div className="min-w-0">
            <div className="font-medium text-sm">Files</div>
            <div className="truncate text-muted-foreground text-xs">
              {selectedFolderPath}
            </div>
          </div>
          <FolderCreateDialog
            parentPath={selectedFolderPath}
            workspaceId={workspaceId}
          />
        </div>
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
                    onAssetDrop={(folderPath) => {
                      if (!draggedAssetId) {
                        return;
                      }

                      moveAsset(draggedAssetId, folderPath).catch(
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
                    workspaceId={workspaceId}
                  />
                ))}
                {optimisticAssets.map((asset) => {
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
                      onDeleted={handleDeleted}
                      onDragEnd={() => setDraggedAssetId(null)}
                      onDragStart={setDraggedAssetId}
                      onOpen={() => {
                        setActiveAssetId(asset.id);
                        setIsRefreshingSelection(true);
                      }}
                      previewUrl={previewUrl}
                      selected={selectedAsset?.id === asset.id}
                      sizeLabel={formatBytes(asset.sizeBytes)}
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
        onAssetUpdated={handleAssetUpdated}
      />
    </div>
  );
};
