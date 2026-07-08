"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import {
  CheckIcon,
  ChevronDownIcon,
  ClipboardIcon,
  Globe2Icon,
  RefreshCwIcon,
  UnlinkIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { TooltipHint } from "@/components/tooltip-hint";

interface AssetCdnControlsProps {
  assetId: string;
  cacheControl?: null | string;
  cdnEnabled: boolean;
  mimeType: string;
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

interface CdnHealthResult {
  cacheControl: null | string;
  cacheControlOk: boolean;
  checkedAt: string;
  contentType: null | string;
  contentTypeOk: boolean;
  ok: boolean;
  publicUrl: null | string;
  urlOk: boolean;
  versionId: string;
}

const getCdnLifecycleState = ({
  enabled,
  isPending,
  publishable,
  publicUrl,
  ready,
}: {
  enabled: boolean;
  isPending: boolean;
  publishable: boolean;
  publicUrl: null | string;
  ready: boolean;
}): CdnLifecycleState => {
  if (!(ready && publishable)) {
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

const publicAssetCacheControl = "public, max-age=31536000, immutable";

const canPublishMimeType = (mimeType: string) => mimeType !== "image/svg+xml";

const getPublicUrlPath = (publicUrl: string) => {
  try {
    return new URL(publicUrl).pathname;
  } catch {
    return "";
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

const EmbedSnippets = ({
  copiedTarget,
  htmlSnippet,
  nextImageConfig,
  onCopy,
  onToggle,
  showSnippets,
}: {
  copiedTarget: CopiedTarget;
  htmlSnippet: null | string;
  nextImageConfig: null | string;
  onCopy: (target: Exclude<CopiedTarget, null>, value: string) => void;
  onToggle: () => void;
  showSnippets: boolean;
}) => (
  <>
    <Button
      aria-expanded={showSnippets}
      className="w-fit"
      onClick={onToggle}
      size="sm"
      type="button"
      variant="ghost"
    >
      <ChevronDownIcon
        className={showSnippets ? "rotate-180 transition" : "transition"}
      />
      Embed snippets
    </Button>

    {showSnippets ? (
      <div className="flex flex-col gap-3 border-t pt-2">
        {nextImageConfig ? (
          <CopyableCodeBlock
            copied={copiedTarget === "next"}
            label="Next.js snippet"
            onCopy={() => onCopy("next", nextImageConfig)}
            value={nextImageConfig}
          />
        ) : null}

        {htmlSnippet ? (
          <CopyableCodeBlock
            copied={copiedTarget === "html"}
            label="HTML snippet"
            onCopy={() => onCopy("html", htmlSnippet)}
            value={htmlSnippet}
          />
        ) : null}
      </div>
    ) : null}
  </>
);

const PublicAssetHealth = ({
  error,
  health,
  isChecking,
  onRefresh,
}: {
  error: null | string;
  health: CdnHealthResult | null;
  isChecking: boolean;
  onRefresh: () => void;
}) => {
  const checkedAt = health
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(health.checkedAt))
    : null;

  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-xs">Public asset health</div>
          <div className="mt-1 text-muted-foreground text-xs">
            {checkedAt
              ? `Last checked ${checkedAt}`
              : "Check URL, content type, and cache headers."}
          </div>
        </div>
        <TooltipHint content="Refresh public asset health">
          <Button
            disabled={isChecking}
            onClick={onRefresh}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <RefreshCwIcon className={isChecking ? "animate-spin" : ""} />
            <span className="sr-only">Refresh health</span>
          </Button>
        </TooltipHint>
      </div>
      {health ? (
        <div className="mt-2 grid gap-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">URL</span>
            <span>{health.urlOk ? "Available" : "Unavailable"}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Content-Type</span>
            <span className="truncate">
              {health.contentTypeOk ? health.contentType : "Mismatch"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Cache-Control</span>
            <span className="truncate">
              {health.cacheControlOk
                ? "Immutable"
                : (health.cacheControl ?? "Missing")}
            </span>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="mt-2 text-destructive text-xs">{error}</div>
      ) : null}
    </div>
  );
};

const PublishedCdnDetails = ({
  copiedTarget,
  currentPublicUrl,
  hasExpectedCachePolicy,
  hasExpectedPublicPath,
  health,
  healthError,
  htmlSnippet,
  isCheckingHealth,
  mimeType,
  nextImageConfig,
  onCopy,
  onRefreshHealth,
  onToggleAdvanced,
  onToggleSnippets,
  showAdvanced,
  showSnippets,
}: {
  copiedTarget: CopiedTarget;
  currentPublicUrl: string;
  hasExpectedCachePolicy: boolean;
  hasExpectedPublicPath: boolean;
  health: CdnHealthResult | null;
  healthError: null | string;
  htmlSnippet: null | string;
  isCheckingHealth: boolean;
  mimeType: string;
  nextImageConfig: null | string;
  onCopy: (target: Exclude<CopiedTarget, null>, value: string) => void;
  onRefreshHealth: () => void;
  onToggleAdvanced: () => void;
  onToggleSnippets: () => void;
  showAdvanced: boolean;
  showSnippets: boolean;
}) => (
  <div className="flex max-w-96 flex-col gap-2">
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-xs">Public URL</span>
        <TooltipHint content="Copy public URL">
          <Button
            onClick={() => onCopy("url", currentPublicUrl)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            {copiedTarget === "url" ? (
              <CheckIcon className="text-primary" />
            ) : (
              <ClipboardIcon />
            )}
            <span className="sr-only">Copy public URL</span>
          </Button>
        </TooltipHint>
      </div>
      <button
        className="block w-full truncate text-left font-mono text-muted-foreground text-xs hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={() => onCopy("url", currentPublicUrl)}
        type="button"
      >
        {currentPublicUrl}
      </button>
    </div>

    <EmbedSnippets
      copiedTarget={copiedTarget}
      htmlSnippet={htmlSnippet}
      nextImageConfig={nextImageConfig}
      onCopy={onCopy}
      onToggle={onToggleSnippets}
      showSnippets={showSnippets}
    />

    <Button
      aria-expanded={showAdvanced}
      className="w-fit"
      onClick={onToggleAdvanced}
      size="sm"
      type="button"
      variant="ghost"
    >
      <ChevronDownIcon
        className={showAdvanced ? "rotate-180 transition" : "transition"}
      />
      Delivery details
    </Button>

    {showAdvanced ? (
      <div className="grid gap-2">
        <PublicAssetHealth
          error={healthError}
          health={health}
          isChecking={isCheckingHealth}
          onRefresh={onRefreshHealth}
        />
        <div className="grid gap-1 rounded-md border bg-muted/20 p-2 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Content type</span>
            <span className="truncate">{mimeType}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Cache policy</span>
            <span>{hasExpectedCachePolicy ? "Immutable" : "Check"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Workspace path</span>
            <span>{hasExpectedPublicPath ? "Matched" : "Check"}</span>
          </div>
        </div>
      </div>
    ) : null}
  </div>
);

export const AssetCdnControls = ({
  assetId,
  cacheControl,
  cdnEnabled,
  mimeType,
  publicUrl,
  ready,
  workspaceId,
}: AssetCdnControlsProps) => {
  const router = useRouter();
  const [enabled, setEnabled] = useState(cdnEnabled);
  const [currentPublicUrl, setCurrentPublicUrl] = useState(publicUrl ?? null);
  const [copiedTarget, setCopiedTarget] = useState<CopiedTarget>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<CdnHealthResult | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isPending, startTransition] = useTransition();
  const publishable = canPublishMimeType(mimeType);
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
    publishable,
    publicUrl: currentPublicUrl,
    ready,
  });
  const publicPath = currentPublicUrl ? getPublicUrlPath(currentPublicUrl) : "";
  const hasExpectedPublicPath =
    !currentPublicUrl || publicPath.startsWith(`/cdn/${workspaceId}/`);
  const hasExpectedCachePolicy =
    !currentPublicUrl || cacheControl === publicAssetCacheControl;

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
  const refreshHealth = async () => {
    if (!currentPublicUrl) {
      return;
    }

    setHealthError(null);
    setIsCheckingHealth(true);

    try {
      const response = await fetch(`/api/assets/${assetId}/cdn-health`);

      if (!response.ok) {
        setHealthError(await getErrorMessage(response));
        return;
      }

      setHealth((await response.json()) as CdnHealthResult);
    } catch {
      setHealthError("Health check failed");
    } finally {
      setIsCheckingHealth(false);
    }
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
                  disabled={isPending || !(ready && publishable)}
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
          <PublishedCdnDetails
            copiedTarget={copiedTarget}
            currentPublicUrl={currentPublicUrl}
            hasExpectedCachePolicy={hasExpectedCachePolicy}
            hasExpectedPublicPath={hasExpectedPublicPath}
            health={health}
            healthError={healthError}
            htmlSnippet={htmlSnippet}
            isCheckingHealth={isCheckingHealth}
            mimeType={mimeType}
            nextImageConfig={nextImageConfig}
            onCopy={copyValue}
            onRefreshHealth={refreshHealth}
            onToggleAdvanced={() => setShowAdvanced((visible) => !visible)}
            onToggleSnippets={() => setShowSnippets((visible) => !visible)}
            showAdvanced={showAdvanced}
            showSnippets={showSnippets}
          />
        ) : (
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-muted-foreground text-xs">
            {ready && publishable
              ? "Publish when this file should be reachable by public URL."
              : "This file is not ready for public delivery yet."}
          </div>
        )}

        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </TooltipProvider>
  );
};
