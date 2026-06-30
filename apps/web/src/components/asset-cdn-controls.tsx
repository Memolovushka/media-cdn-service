"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import {
  CheckIcon,
  ClipboardIcon,
  EyeIcon,
  EyeOffIcon,
  Globe2Icon,
  MoreHorizontalIcon,
  UnlinkIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { TooltipHint } from "@/components/tooltip-hint";

interface AssetCdnControlsProps {
  assetId: string;
  cdnEnabled: boolean;
  publicUrl?: null | string;
  ready: boolean;
  workspaceId: string;
}

const getErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "Asset update failed";
};

const copiedResetDelayMs = 1600;
const httpsProtocol = "https:";

interface AssetPatchResponse {
  publicUrl?: null | string;
}

const PublicUrlCopyRow = ({
  isVisible,
  onCopy,
  onToggleVisibility,
  url,
}: {
  isVisible: boolean;
  onCopy: () => void;
  onToggleVisibility: () => void;
  url: string;
}) => (
  <div className="flex flex-wrap items-center gap-1">
    <TooltipHint content="Copy public CDN URL">
      <button
        aria-label="Copy public CDN URL"
        className="min-h-7 max-w-72 rounded-md border bg-muted/30 px-2 py-1 text-left font-mono text-muted-foreground text-xs transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={onCopy}
        type="button"
      >
        {isVisible ? (
          <span className="break-all">{url}</span>
        ) : (
          <span className="block truncate">CDN URL</span>
        )}
      </button>
    </TooltipHint>
    <TooltipHint content={isVisible ? "Hide public URL" : "Show public URL"}>
      <Button
        aria-pressed={isVisible}
        className="shrink-0"
        onClick={onToggleVisibility}
        size="icon"
        type="button"
        variant="outline"
      >
        {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        <span className="sr-only">
          {isVisible ? "Hide public URL" : "Show public URL"}
        </span>
      </Button>
    </TooltipHint>
  </div>
);

const CdnActionsMenu = ({
  copiedTarget,
  disabled,
  onCopyNextImageConfig,
  showNextImageConfig,
}: {
  copiedTarget: "config" | "url" | null;
  disabled: boolean;
  onCopyNextImageConfig: () => void;
  showNextImageConfig: boolean;
}) => (
  <Popover>
    <TooltipProvider>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <Button size="icon-sm" type="button" variant="outline">
              <MoreHorizontalIcon />
              <span className="sr-only">CDN actions</span>
            </Button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent>CDN actions</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    <PopoverContent align="start" className="w-44 gap-1 p-1">
      <TooltipHint content="Copy the Next.js image config for this CDN path">
        <button
          className="flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0"
          disabled={disabled || !showNextImageConfig}
          onClick={onCopyNextImageConfig}
          type="button"
        >
          {copiedTarget === "config" ? <CheckIcon /> : <ClipboardIcon />}
          Copy Next config
        </button>
      </TooltipHint>
    </PopoverContent>
  </Popover>
);

export const AssetCdnControls = ({
  assetId,
  cdnEnabled,
  publicUrl,
  ready,
  workspaceId,
}: AssetCdnControlsProps) => {
  const router = useRouter();
  const [enabled, setEnabled] = useState(cdnEnabled);
  const [currentPublicUrl, setCurrentPublicUrl] = useState(publicUrl ?? null);
  const [copiedTarget, setCopiedTarget] = useState<"config" | "url" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isPublicUrlVisible, setIsPublicUrlVisible] = useState(false);
  const [isPending, startTransition] = useTransition();
  const nextImageConfig = useMemo(() => {
    if (!currentPublicUrl) {
      return null;
    }

    const url = new URL(currentPublicUrl);
    const protocol = url.protocol === httpsProtocol ? "https" : "http";

    return `images: {
  remotePatterns: [
    {
      protocol: "${protocol}",
      hostname: "${url.hostname}",
      pathname: "/cdn/${workspaceId}/**",
    },
  ],
},`;
  }, [currentPublicUrl, workspaceId]);

  const patchAsset = ({
    body,
    nextEnabled,
  }: {
    body: Record<string, unknown>;
    nextEnabled?: boolean;
  }) => {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setEnabled(cdnEnabled);
        setCurrentPublicUrl(publicUrl ?? null);
        setError(await getErrorMessage(response));
        return;
      }

      const payload = (await response
        .json()
        .catch(() => null)) as AssetPatchResponse | null;

      if (nextEnabled !== undefined) {
        setEnabled(nextEnabled);
      }

      if (nextEnabled === false) {
        setCurrentPublicUrl(null);
        setIsPublicUrlVisible(false);
      }

      if (payload?.publicUrl) {
        setCurrentPublicUrl(payload.publicUrl);
      }

      router.refresh();
    });
  };

  const copyUrl = () => {
    if (!currentPublicUrl) {
      return;
    }

    startTransition(async () => {
      await navigator.clipboard.writeText(currentPublicUrl);
      setCopiedTarget("url");
      window.setTimeout(() => setCopiedTarget(null), copiedResetDelayMs);
    });
  };

  const copyNextImageConfig = () => {
    if (!nextImageConfig) {
      return;
    }

    startTransition(async () => {
      await navigator.clipboard.writeText(nextImageConfig);
      setCopiedTarget("config");
      window.setTimeout(() => setCopiedTarget(null), copiedResetDelayMs);
    });
  };

  let cdnUrlContent = (
    <p className="text-muted-foreground text-xs">
      Upload must finish before CDN publishing.
    </p>
  );

  if (currentPublicUrl) {
    cdnUrlContent = (
      <div className="flex max-w-96 flex-col gap-1">
        <PublicUrlCopyRow
          isVisible={isPublicUrlVisible}
          onCopy={copyUrl}
          onToggleVisibility={() =>
            setIsPublicUrlVisible((visible) => !visible)
          }
          url={currentPublicUrl}
        />
      </div>
    );
  } else if (ready) {
    cdnUrlContent = (
      <p className="text-muted-foreground text-xs">
        Publish to get a public URL for your site.
      </p>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-w-72 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {enabled ? (
            <TooltipHint content="Remove this file from public CDN delivery">
              <Button
                disabled={isPending}
                onClick={() => {
                  setEnabled(false);
                  patchAsset({
                    body: { cdnEnabled: false },
                    nextEnabled: false,
                  });
                }}
                size="sm"
                type="button"
                variant="destructive"
              >
                <UnlinkIcon />
                Disable CDN
              </Button>
            </TooltipHint>
          ) : (
            <TooltipHint content="Publish this ready file to the public CDN">
              <Button
                disabled={isPending || !ready}
                onClick={() => {
                  patchAsset({
                    body: { cdnEnabled: true },
                    nextEnabled: true,
                  });
                }}
                size="sm"
                type="button"
              >
                <Globe2Icon />
                Publish to CDN
              </Button>
            </TooltipHint>
          )}

          {currentPublicUrl ? (
            <CdnActionsMenu
              copiedTarget={copiedTarget}
              disabled={isPending}
              onCopyNextImageConfig={copyNextImageConfig}
              showNextImageConfig={Boolean(nextImageConfig)}
            />
          ) : null}

          {copiedTarget === "url" ? (
            <span className="flex items-center gap-1 text-primary text-xs">
              <CheckIcon className="size-3" />
              Copied
            </span>
          ) : null}
        </div>

        {cdnUrlContent}

        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </TooltipProvider>
  );
};
