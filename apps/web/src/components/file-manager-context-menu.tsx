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
import { Button } from "@workspace/ui/components/button";
import {
  DownloadIcon,
  EyeIcon,
  FolderOpenIcon,
  MousePointerClickIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactElement, ReactNode } from "react";
import {
  cloneElement,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";

type ContextMenuChild = ReactElement<{
  onContextMenu?: (event: MouseEvent) => void;
}>;

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
    type="button"
  >
    {children}
  </button>
);

const LightweightContextMenu = ({
  children,
  items,
}: {
  children: ContextMenuChild;
  items: (closeMenu: () => void) => ReactNode;
}) => {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const closeMenu = useCallback(() => setPosition(null), []);

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

  return (
    <>
      {cloneElement(children, {
        onContextMenu: (event: MouseEvent) => {
          children.props.onContextMenu?.(event);
          event.preventDefault();
          setPosition({ x: event.clientX, y: event.clientY });
        },
      })}
      {position
        ? createPortal(
            <div
              className="fixed z-50 min-w-36 rounded-lg bg-popover/95 p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur-sm"
              role="menu"
              style={{ left: position.x, top: position.y }}
            >
              {items(closeMenu)}
            </div>,
            document.body
          )
        : null}
    </>
  );
};

export const FolderContextMenu = ({
  children,
  folderHref,
  folderPath,
  workspaceId,
}: {
  children: ContextMenuChild;
  folderHref: string;
  folderPath: string;
  workspaceId: string;
}) => {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      <LightweightContextMenu
        items={(closeMenu) => (
          <>
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
          </>
        )}
      >
        {children}
      </LightweightContextMenu>

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

export const AssetContextMenu = ({
  children,
  downloadUrl,
  href,
  previewUrl,
}: {
  children: ContextMenuChild;
  downloadUrl?: null | string;
  href: string;
  previewUrl?: null | string;
}) => (
  <LightweightContextMenu
    items={(closeMenu) => (
      <>
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
      </>
    )}
  >
    {children}
  </LightweightContextMenu>
);
