"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Switch } from "@workspace/ui/components/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { CheckIcon, ClipboardIcon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

interface AssetCdnControlsProps {
  assetId: string;
  cdnEnabled: boolean;
  publicUrl?: null | string;
  ready: boolean;
  tags: string[];
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

export const AssetCdnControls = ({
  assetId,
  cdnEnabled,
  publicUrl,
  ready,
  tags,
}: AssetCdnControlsProps) => {
  const router = useRouter();
  const [enabled, setEnabled] = useState(cdnEnabled);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagValue, setTagValue] = useState(tags.join(", "));
  const [isPending, startTransition] = useTransition();
  const currentTags = useMemo(() => parseTags(tagValue), [tagValue]);

  const patchAsset = (body: Record<string, unknown>) => {
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
        setError(await getErrorMessage(response));
        return;
      }

      router.refresh();
    });
  };

  const copyUrl = () => {
    if (!publicUrl) {
      return;
    }

    startTransition(async () => {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), copiedResetDelayMs);
    });
  };

  return (
    <TooltipProvider>
      <div className="flex min-w-72 flex-col gap-2">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Switch
                checked={enabled}
                disabled={isPending || !ready}
                onCheckedChange={(nextEnabled) => {
                  setEnabled(nextEnabled);
                  patchAsset({ cdnEnabled: nextEnabled });
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {ready ? "Publish to CDN" : "Asset version is not ready"}
            </TooltipContent>
          </Tooltip>
          {enabled ? (
            <Badge>Enabled</Badge>
          ) : (
            <Badge variant="outline">Private</Badge>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={isPending || !publicUrl}
                onClick={copyUrl}
                size="icon"
                type="button"
                variant="ghost"
              >
                {copied ? <CheckIcon /> : <ClipboardIcon />}
                <span className="sr-only">Copy public URL</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {publicUrl ? "Copy public URL" : "No public URL yet"}
            </TooltipContent>
          </Tooltip>
        </div>

        {publicUrl ? (
          <div className="max-w-80 truncate font-mono text-muted-foreground text-xs">
            {publicUrl}
          </div>
        ) : null}

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
                onClick={() => patchAsset({ tags: currentTags })}
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
