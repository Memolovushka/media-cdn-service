"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import {
  CheckIcon,
  ChevronDownIcon,
  ClipboardIcon,
  Globe2Icon,
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

type CdnLifecycleState = "blocked" | "private" | "public" | "publishing";
type CopiedTarget = "html" | "next" | "url" | null;

const getCdnLifecycleState = ({
  enabled,
  isPending,
  publicUrl,
  ready,
}: {
  enabled: boolean;
  isPending: boolean;
  publicUrl: null | string;
  ready: boolean;
}): CdnLifecycleState => {
  if (!ready) {
    return "blocked";
  }

  if (isPending) {
    return "publishing";
  }

  if (enabled && publicUrl) {
    return "public";
  }

  return "private";
};

const getLifecycleLabel = (state: CdnLifecycleState) => {
  switch (state) {
    case "blocked":
      return "Blocked";
    case "private":
      return "Private";
    case "public":
      return "Public";
    case "publishing":
      return "Publishing";
    default:
      return "Private";
  }
};

const getLifecycleDescription = (state: CdnLifecycleState) => {
  switch (state) {
    case "blocked":
      return "Upload must finish before this file can be published.";
    case "private":
      return "Only authenticated workspace members can access this file.";
    case "public":
      return "This version has a stable public CDN URL.";
    case "publishing":
      return "Updating public CDN delivery for this file.";
    default:
      return "Only authenticated workspace members can access this file.";
  }
};

const getLifecycleVariant = (state: CdnLifecycleState) => {
  if (state === "public") {
    return "default" as const;
  }

  if (state === "blocked") {
    return "destructive" as const;
  }

  return "outline" as const;
};

const CopyableCodeBlock = ({
  copied,
  label,
  onCopy,
  value,
}: {
  copied: boolean;
  label: string;
  onCopy: () => void;
  value: string;
}) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium text-muted-foreground text-xs">{label}</span>
      <TooltipHint content={`Copy ${label}`}>
        <Button onClick={onCopy} size="icon-xs" type="button" variant="ghost">
          {copied ? <CheckIcon className="text-primary" /> : <ClipboardIcon />}
          <span className="sr-only">Copy {label}</span>
        </Button>
      </TooltipHint>
    </div>
    <TooltipHint content={`Copy ${label}`}>
      <button
        aria-label={`Copy ${label}`}
        className="max-h-24 overflow-auto rounded-md border bg-muted/30 px-2 py-1.5 text-left font-mono text-muted-foreground text-xs transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={onCopy}
        type="button"
      >
        <code className="whitespace-pre-wrap break-all">{value}</code>
      </button>
    </TooltipHint>
  </div>
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
  const [copiedTarget, setCopiedTarget] = useState<CopiedTarget>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);
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
  const htmlSnippet = useMemo(() => {
    if (!currentPublicUrl) {
      return null;
    }

    return `<img src="${currentPublicUrl}" alt="" loading="lazy" />`;
  }, [currentPublicUrl]);
  const lifecycleState = getCdnLifecycleState({
    enabled,
    isPending,
    publicUrl: currentPublicUrl,
    ready,
  });

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

  const copyValue = async (
    target: Exclude<CopiedTarget, null>,
    value: string
  ) => {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedTarget(target);
    window.setTimeout(() => setCopiedTarget(null), copiedResetDelayMs);
  };

  return (
    <TooltipProvider>
      <div className="flex min-w-72 flex-col gap-3">
        <div className="border-b pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-sm">CDN delivery</div>
              <p className="mt-1 text-muted-foreground text-xs">
                {getLifecycleDescription(lifecycleState)}
              </p>
            </div>
            <Badge variant={getLifecycleVariant(lifecycleState)}>
              {getLifecycleLabel(lifecycleState)}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
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
          </div>
        </div>

        {currentPublicUrl ? (
          <div className="flex max-w-96 flex-col gap-2">
            <CopyableCodeBlock
              copied={copiedTarget === "url"}
              label="Public CDN URL"
              onCopy={() => copyValue("url", currentPublicUrl)}
              value={currentPublicUrl}
            />

            <Button
              aria-expanded={showSnippets}
              className="w-fit"
              onClick={() => setShowSnippets((visible) => !visible)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ChevronDownIcon
                className={
                  showSnippets ? "rotate-180 transition" : "transition"
                }
              />
              Embed snippets
            </Button>

            {showSnippets ? (
              <div className="flex flex-col gap-3 border-t pt-2">
                {nextImageConfig ? (
                  <CopyableCodeBlock
                    copied={copiedTarget === "next"}
                    label="Next.js snippet"
                    onCopy={() => copyValue("next", nextImageConfig)}
                    value={nextImageConfig}
                  />
                ) : null}

                {htmlSnippet ? (
                  <CopyableCodeBlock
                    copied={copiedTarget === "html"}
                    label="HTML snippet"
                    onCopy={() => copyValue("html", htmlSnippet)}
                    value={htmlSnippet}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            {ready
              ? "Publish to get a public URL and embed snippets."
              : "Upload must finish before CDN publishing."}
          </p>
        )}

        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </TooltipProvider>
  );
};
