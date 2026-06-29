"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import {
  CheckIcon,
  ClipboardIcon,
  Globe2Icon,
  SaveIcon,
  UnlinkIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

interface AssetCdnControlsProps {
  assetId: string;
  cdnEnabled: boolean;
  publicUrl?: null | string;
  ready: boolean;
  tags: string[];
  workspaceId: string;
}

const getErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "Asset update failed";
};

const parseTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const copiedResetDelayMs = 1600;
const httpsProtocol = "https:";

interface AssetPatchResponse {
  publicUrl?: null | string;
}

export const AssetCdnControls = ({
  assetId,
  cdnEnabled,
  publicUrl,
  ready,
  tags,
  workspaceId,
}: AssetCdnControlsProps) => {
  const router = useRouter();
  const [enabled, setEnabled] = useState(cdnEnabled);
  const [currentPublicUrl, setCurrentPublicUrl] = useState(publicUrl ?? null);
  const [copiedTarget, setCopiedTarget] = useState<"config" | "url" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [tagValue, setTagValue] = useState(tags.join(", "));
  const [isPending, startTransition] = useTransition();
  const currentTags = useMemo(() => parseTags(tagValue), [tagValue]);
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
      <div className="flex max-w-96 flex-col gap-2">
        <button
          aria-label="Public CDN URL"
          className="rounded-md border bg-muted/30 px-3 py-2 text-left font-mono text-muted-foreground text-xs transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={copyUrl}
          type="button"
        >
          <span className="break-all">{currentPublicUrl}</span>
        </button>
        {nextImageConfig ? (
          <Button
            className="w-fit"
            disabled={isPending}
            onClick={copyNextImageConfig}
            size="xs"
            type="button"
            variant="outline"
          >
            {copiedTarget === "config" ? <CheckIcon /> : <ClipboardIcon />}
            Copy Next config
          </Button>
        ) : null}
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
            <Badge>Enabled</Badge>
          ) : (
            <Badge variant="outline">Private</Badge>
          )}

          {enabled ? (
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
              variant="outline"
            >
              <UnlinkIcon />
              Disable CDN
            </Button>
          ) : (
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
          )}

          {copiedTarget === "url" ? (
            <span className="flex items-center gap-1 text-primary text-xs">
              <CheckIcon className="size-3" />
              Copied
            </span>
          ) : null}
        </div>

        {cdnUrlContent}

        <div className="flex max-w-80 items-center gap-1">
          <Input
            aria-label="Asset tags"
            className="h-7 text-xs"
            disabled={isPending}
            onChange={(event) => setTagValue(event.target.value)}
            placeholder="tags"
            value={tagValue}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={isPending}
                onClick={() => patchAsset({ body: { tags: currentTags } })}
                size="icon"
                type="button"
                variant="outline"
              >
                <SaveIcon />
                <span className="sr-only">Save tags</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save tags</TooltipContent>
          </Tooltip>
        </div>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </TooltipProvider>
  );
};
