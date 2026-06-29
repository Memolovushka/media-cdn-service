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
  DownloadIcon,
  EyeIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  MousePointerClickIcon,
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
import { FolderDeleteButton } from "@/components/folder-delete-button";

interface MenuPosition {
  x: number;
  y: number;
}

const getErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "Folder deletion failed";
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
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, position]);

  return { closeMenu, openMenu, position };
};

export const FolderTableRowClient = ({
  folderHref,
  folderName,
  folderPath,
  workspaceId,
}: {
  folderHref: string;
  folderName: string;
  folderPath: string;
  workspaceId: string;
}) => {
  const router = useRouter();
  const { closeMenu, openMenu, position } = useRowContextMenu();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const openFolder = () => router.push(folderHref as Route);

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
        className="cursor-pointer hover:bg-muted/40"
        onClick={openFolder}
        onContextMenu={openMenu}
        onKeyDown={(event) => handleRowKeyDown({ event, onOpen: openFolder })}
        role="link"
        tabIndex={0}
      >
        <TableCell>
          <div className="flex min-w-0 items-center gap-1 text-primary">
            <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{folderName}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline">Folder</Badge>
        </TableCell>
        <TableCell>-</TableCell>
        <TableCell
          className="text-right"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <FolderDeleteButton
            folderPath={folderPath}
            workspaceId={workspaceId}
          />
        </TableCell>
      </TableRow>

      <FloatingMenu position={position}>
        <MenuItem
          onSelect={() => {
            closeMenu();
            window.location.href = folderHref;
          }}
        >
          <FolderOpenIcon />
          Open
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
              Empty folders can be deleted. Files and child folders must be
              moved or removed first.
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
  downloadUrl,
  filename,
  href,
  mimeType,
  previewUrl,
  selected,
  sizeLabel,
  statusLabel,
  statusVariant,
}: {
  downloadUrl?: null | string;
  filename: string;
  href: string;
  mimeType: string;
  previewUrl?: null | string;
  selected: boolean;
  sizeLabel: string;
  statusLabel: string;
  statusVariant: ComponentProps<typeof Badge>["variant"];
}) => {
  const router = useRouter();
  const { closeMenu, openMenu, position } = useRowContextMenu();
  const openAsset = () => router.push(href as Route);

  return (
    <>
      <TableRow
        aria-current={selected ? "page" : undefined}
        className={
          selected
            ? "cursor-pointer bg-muted/60 hover:bg-muted/70"
            : "cursor-pointer hover:bg-muted/40"
        }
        onClick={openAsset}
        onContextMenu={openMenu}
        onKeyDown={(event) => handleRowKeyDown({ event, onOpen: openAsset })}
        role="link"
        tabIndex={0}
      >
        <TableCell>
          <div className="flex min-w-0 items-center gap-1 text-left text-primary">
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="truncate font-medium">{filename}</div>
              <div className="truncate text-muted-foreground text-xs">
                {mimeType}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </TableCell>
        <TableCell>{sizeLabel}</TableCell>
        <TableCell />
      </TableRow>

      <FloatingMenu position={position}>
        <MenuItem
          onSelect={() => {
            closeMenu();
            window.location.href = href;
          }}
        >
          <MousePointerClickIcon />
          Open
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
      </FloatingMenu>
    </>
  );
};
