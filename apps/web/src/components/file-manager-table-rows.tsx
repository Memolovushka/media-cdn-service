"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { TableCell, TableRow } from "@workspace/ui/components/table";
import {
  ClipboardIcon,
  DownloadIcon,
  EyeIcon,
  FileAudioIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon,
  FolderOpenIcon,
  Globe2Icon,
  MousePointerClickIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type {
  ComponentProps,
  MouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { TooltipHint } from "@/components/tooltip-hint";

interface MenuPosition {
  x: number;
  y: number;
}

const contextMenuOpeningEventName = "media-cdn-context-menu-opening";

const getAssetTypeVisual = (mimeType: string) => {
  if (mimeType === "image/svg+xml") {
    return {
      Icon: FileImageIcon,
      label: "SVG",
      tileClassName: "bg-emerald-500/10 text-emerald-700",
    };
  }

  if (mimeType.startsWith("image/")) {
    return {
      Icon: FileImageIcon,
      label: "Image",
      tileClassName: "bg-sky-500/10 text-sky-700",
    };
  }

  if (mimeType.startsWith("video/")) {
    return {
      Icon: FileVideoIcon,
      label: "Video",
      tileClassName: "bg-violet-500/10 text-violet-700",
    };
  }

  if (mimeType.startsWith("audio/")) {
    return {
      Icon: FileAudioIcon,
      label: "Audio",
      tileClassName: "bg-amber-500/10 text-amber-700",
    };
  }

  if (mimeType === "application/pdf") {
    return {
      Icon: FileTextIcon,
      label: "PDF",
      tileClassName: "bg-rose-500/10 text-rose-700",
    };
  }

  if (mimeType.startsWith("text/")) {
    return {
      Icon: FileTextIcon,
      label: "Text",
      tileClassName: "bg-cyan-500/10 text-cyan-700",
    };
  }

  return {
    Icon: FileIcon,
    label: "File",
    tileClassName: "bg-muted text-muted-foreground",
  };
};

const getErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "Deletion failed";
};

const MenuSeparator = () => <div className="-mx-1 my-1 h-px bg-border/50" />;

const MenuItem = ({
  children,
  disabled,
  onSelect,
  variant = "default",
}: {
  children: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
  variant?: "default" | "destructive";
}) => (
  <button
    className="flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[variant=destructive]:text-destructive data-[variant=destructive]:hover:bg-destructive/10 [&_svg]:size-3.5 [&_svg]:shrink-0"
    data-variant={variant}
    disabled={disabled}
    onClick={onSelect}
    role="menuitem"
    type="button"
  >
    {children}
  </button>
);

const FloatingMenu = ({
  children,
  position,
}: {
  children: ReactNode;
  position: MenuPosition | null;
}) =>
  position
    ? createPortal(
        <div
          className="fixed z-50 min-w-36 rounded-lg bg-popover/95 p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur-sm"
          role="menu"
          style={{ left: position.x, top: position.y }}
        >
          {children}
        </div>,
        document.body
      )
    : null;

const handleRowKeyDown = ({
  event,
  onOpen,
}: {
  event: ReactKeyboardEvent<HTMLTableRowElement>;
  onOpen: () => void;
}) => {
  if (!(event.key === "Enter" || event.key === " ")) {
    return;
  }

  event.preventDefault();
  onOpen();
};

const useRowContextMenu = () => {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const closeMenu = useCallback(() => setPosition(null), []);
  const openMenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new Event(contextMenuOpeningEventName));
    setPosition({ x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    if (!position) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    window.addEventListener(contextMenuOpeningEventName, closeMenu);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
      window.removeEventListener(contextMenuOpeningEventName, closeMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, position]);

  return { closeMenu, openMenu, position };
};

const getAssetRowClassName = ({
  selected,
  selectedForBulk,
}: {
  selected: boolean;
  selectedForBulk: boolean;
}) => {
  if (selectedForBulk) {
    return "group h-12 cursor-pointer border-l-2 border-l-primary bg-primary/15 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.22)] hover:bg-primary/20";
  }

  if (selected) {
    return "group h-12 cursor-pointer border-l-2 border-l-primary bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18)] hover:bg-primary/15";
  }

  return "group h-12 cursor-pointer border-l-2 border-l-transparent hover:bg-muted/40";
};

export const FolderTableRowClient = ({
  folderHref,
  folderName,
  folderPath,
  onBulkSelect,
  onAssetDrop,
  onDragEnd,
  onDragStart,
  onFileDrop,
  onOpen,
  selected = false,
  selectedForBulk = false,
  selectableId,
  selectMode = false,
  workspaceId,
}: {
  folderHref: string;
  folderName: string;
  folderPath: string;
  onBulkSelect?: (
    folderPath: string,
    shiftKey: boolean,
    shouldSelect: boolean
  ) => void;
  onAssetDrop?: (folderPath: string) => void;
  onDragEnd?: () => void;
  onDragStart?: (folderPath: string) => void;
  onFileDrop?: (folderPath: string, files: File[]) => void;
  onOpen?: (folderPath: string) => void;
  selected?: boolean;
  selectedForBulk?: boolean;
  selectableId?: string;
  selectMode?: boolean;
  workspaceId: string;
}) => {
  const router = useRouter();
  const { closeMenu, openMenu, position } = useRowContextMenu();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const openFolder = () => {
    onOpen?.(folderPath);
    router.push(folderHref as Route);
  };
  const toggleBulkSelection = (shiftKey: boolean, forceSelect = false) => {
    onBulkSelect?.(folderPath, shiftKey, forceSelect || !selectedForBulk);
  };

  const deleteFolder = () => {
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/folders", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          path: folderPath,
        }),
      });

      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }

      setDeleteOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <TableRow
        aria-selected={selected || selectedForBulk}
        className={getAssetRowClassName({
          selected,
          selectedForBulk,
        })}
        data-selectable-id={selectableId}
        draggable
        onClick={(event) => {
          if (event.shiftKey) {
            event.preventDefault();
            toggleBulkSelection(true, true);
            return;
          }

          if (selectMode) {
            toggleBulkSelection(false);
            return;
          }

          openFolder();
        }}
        onContextMenu={openMenu}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          const isFileDrop = event.dataTransfer.types.includes("Files");

          if (!(onAssetDrop || (isFileDrop && onFileDrop))) {
            return;
          }

          event.preventDefault();
          event.dataTransfer.dropEffect = isFileDrop ? "copy" : "move";
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          onDragStart?.(folderPath);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (event.dataTransfer.types.includes("Files")) {
            const files = Array.from(event.dataTransfer.files);

            if (files.length) {
              onFileDrop?.(folderPath, files);
            }

            return;
          }

          onAssetDrop?.(folderPath);
        }}
        onKeyDown={(event) => {
          if (selectMode && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            toggleBulkSelection(event.shiftKey);
            return;
          }

          handleRowKeyDown({ event, onOpen: openFolder });
        }}
        role="link"
        tabIndex={0}
      >
        <TableCell>
          <div className="flex min-w-0 items-center gap-2 text-primary">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-700">
              <FolderIcon className="size-4" />
            </span>
            <span className="truncate font-medium text-sm">{folderName}</span>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">Folder</TableCell>
        <TableCell className="text-muted-foreground text-xs">-</TableCell>
        <TableCell className="text-xs">-</TableCell>
        <TableCell
          className="w-28 text-right"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <TooltipHint content={`Open folder ${folderName}`}>
              <Button
                aria-label={`Open ${folderName}`}
                onClick={openFolder}
                size="icon-sm"
                variant="ghost"
              >
                <FolderOpenIcon />
              </Button>
            </TooltipHint>
            <TooltipHint content={`Delete folder ${folderName}`}>
              <Button
                aria-label={`Delete ${folderName}`}
                disabled={isPending}
                onClick={() => setDeleteOpen(true)}
                size="icon-sm"
                variant="ghost"
              >
                <TrashIcon />
              </Button>
            </TooltipHint>
          </div>
        </TableCell>
      </TableRow>

      <FloatingMenu position={position}>
        <MenuItem
          onSelect={() => {
            closeMenu();
            openFolder();
          }}
        >
          <FolderOpenIcon />
          Open
        </MenuItem>
        <MenuItem
          onSelect={() => {
            closeMenu();
            toggleBulkSelection(false, true);
          }}
        >
          <MousePointerClickIcon />
          Select for move
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          onSelect={() => {
            closeMenu();
            setDeleteOpen(true);
          }}
          variant="destructive"
        >
          <TrashIcon />
          Delete
        </MenuItem>
      </FloatingMenu>

      <AlertDialog
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen);
          setError(null);
        }}
        open={deleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the folder, all nested folders, and all files inside
              them from the workspace file manager.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              disabled={isPending}
              onClick={deleteFolder}
              variant="destructive"
            >
              <TrashIcon />
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const AssetTableRowClient = ({
  assetId,
  cdnLabel,
  cdnVariant,
  downloadUrl,
  filename,
  href,
  mimeType,
  onBulkSelect,
  onDeleted,
  onDragEnd,
  onDragStart,
  onOpen,
  onPublish,
  onRename,
  previewUrl,
  publicUrl,
  publishDisabled = false,
  selectMode = false,
  selected,
  selectedForBulk = false,
  selectableId,
  sizeLabel,
}: {
  assetId: string;
  cdnLabel: string;
  cdnVariant: ComponentProps<typeof Badge>["variant"];
  downloadUrl?: null | string;
  filename: string;
  href: string;
  mimeType: string;
  onBulkSelect?: (
    assetId: string,
    shiftKey: boolean,
    selected: boolean
  ) => void;
  onDeleted?: (assetId: string) => void;
  onDragEnd?: () => void;
  onDragStart?: (assetId: string) => void;
  onOpen?: () => void;
  onPublish?: () => void;
  onRename?: () => void;
  previewUrl?: null | string;
  publicUrl?: null | string;
  publishDisabled?: boolean;
  selectMode?: boolean;
  selected: boolean;
  selectedForBulk?: boolean;
  selectableId?: string;
  sizeLabel: string;
}) => {
  const router = useRouter();
  const { closeMenu, openMenu, position } = useRowContextMenu();
  const assetVisual = getAssetTypeVisual(mimeType);
  const AssetTypeIcon = assetVisual.Icon;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const openAsset = () => {
    onOpen?.();
    router.push(href as Route);
  };
  const copyPublicUrl = () => {
    if (!publicUrl) {
      return;
    }

    navigator.clipboard.writeText(publicUrl).catch(() => undefined);
  };
  const toggleBulkSelection = (shiftKey: boolean, forceSelect = false) => {
    onBulkSelect?.(assetId, shiftKey, forceSelect || !selectedForBulk);
  };
  const deleteAsset = () => {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }

      setDeleteOpen(false);
      onDeleted?.(assetId);
      router.refresh();
    });
  };

  return (
    <>
      <TableRow
        aria-current={selected ? "page" : undefined}
        aria-selected={selected || selectedForBulk}
        className={getAssetRowClassName({ selected, selectedForBulk })}
        data-selectable-id={selectableId}
        draggable
        onClick={(event) => {
          if (event.shiftKey) {
            event.preventDefault();
            toggleBulkSelection(true, true);
            return;
          }

          if (selectMode) {
            toggleBulkSelection(false);
            return;
          }

          openAsset();
        }}
        onContextMenu={openMenu}
        onDragEnd={onDragEnd}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          onDragStart?.(assetId);
        }}
        onKeyDown={(event) => {
          if (selectMode && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            toggleBulkSelection(event.shiftKey);
            return;
          }

          handleRowKeyDown({ event, onOpen: openAsset });
        }}
        role="link"
        tabIndex={0}
      >
        <TableCell className="py-2">
          <div className="flex min-w-0 items-center gap-2 text-left text-primary">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-md ${assetVisual.tileClassName}`}
            >
              <AssetTypeIcon className="size-4" />
            </span>
            <span className="min-w-0 truncate font-medium text-sm">
              {filename}
            </span>
          </div>
        </TableCell>
        <TableCell className="max-w-40 truncate text-muted-foreground">
          <span className="font-medium text-foreground text-xs">
            {assetVisual.label}
          </span>
          <span className="ml-2 text-xs">{mimeType}</span>
        </TableCell>
        <TableCell>
          <Badge variant={cdnVariant}>{cdnLabel}</Badge>
        </TableCell>
        <TableCell className="text-xs">{sizeLabel}</TableCell>
        <TableCell
          className="w-32 text-right"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <TooltipHint content={`Preview ${filename}`}>
              <Button
                aria-label={`Preview ${filename}`}
                disabled={!previewUrl}
                onClick={() => {
                  if (previewUrl) {
                    window.open(previewUrl, "_blank", "noopener,noreferrer");
                  }
                }}
                size="icon-sm"
                variant="ghost"
              >
                <EyeIcon />
              </Button>
            </TooltipHint>
            <TooltipHint content={`Copy public URL for ${filename}`}>
              <Button
                aria-label={`Copy public URL for ${filename}`}
                disabled={!publicUrl}
                onClick={copyPublicUrl}
                size="icon-sm"
                variant="ghost"
              >
                <ClipboardIcon />
              </Button>
            </TooltipHint>
            <TooltipHint content={`Delete file ${filename}`}>
              <Button
                aria-label={`Delete ${filename}`}
                disabled={isPending}
                onClick={() => setDeleteOpen(true)}
                size="icon-sm"
                variant="ghost"
              >
                <TrashIcon />
              </Button>
            </TooltipHint>
          </div>
        </TableCell>
      </TableRow>

      <FloatingMenu position={position}>
        <MenuItem
          onSelect={() => {
            closeMenu();
            openAsset();
          }}
        >
          <MousePointerClickIcon />
          Show details
        </MenuItem>
        <MenuItem
          onSelect={() => {
            closeMenu();
            onRename?.();
          }}
        >
          <PencilIcon />
          Rename
        </MenuItem>
        <MenuItem
          disabled={!previewUrl}
          onSelect={() => {
            closeMenu();
            if (previewUrl) {
              window.open(previewUrl, "_blank", "noopener,noreferrer");
            }
          }}
        >
          <EyeIcon />
          Preview
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled={!downloadUrl}
          onSelect={() => {
            closeMenu();
            if (downloadUrl) {
              window.location.href = downloadUrl;
            }
          }}
        >
          <DownloadIcon />
          Download
        </MenuItem>
        <MenuItem
          disabled={publishDisabled}
          onSelect={() => {
            closeMenu();
            onPublish?.();
          }}
        >
          <Globe2Icon />
          Publish to CDN
        </MenuItem>
        <MenuItem
          disabled={!publicUrl}
          onSelect={() => {
            closeMenu();
            copyPublicUrl();
          }}
        >
          <ClipboardIcon />
          Copy public URL
        </MenuItem>
        <MenuItem
          onSelect={() => {
            closeMenu();
            toggleBulkSelection(false, true);
          }}
        >
          <MousePointerClickIcon />
          Select for move
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled={isPending}
          onSelect={() => {
            closeMenu();
            setDeleteOpen(true);
          }}
          variant="destructive"
        >
          <TrashIcon />
          Delete
        </MenuItem>
      </FloatingMenu>

      <AlertDialog
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen);
          setError(null);
        }}
        open={deleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the file from the workspace file manager.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              disabled={isPending}
              onClick={deleteAsset}
              variant="destructive"
            >
              <TrashIcon />
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
