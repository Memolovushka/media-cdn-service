import { Badge } from "@workspace/ui/components/badge";
import { Progress } from "@workspace/ui/components/progress";
import type { WorkspaceStorageUsage } from "@/server/assets";

const bytesPerUnit = 1024;
const freeTierStorageBytes = 10 * bytesPerUnit * bytesPerUnit * bytesPerUnit;
const minimumVisiblePercent = 0.01;
const percentMultiplier = 100;

const formatBytes = (bytes: number) => {
  if (bytes < bytesPerUnit) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / bytesPerUnit;
  let unitIndex = 0;

  while (value >= bytesPerUnit && unitIndex < units.length - 1) {
    value /= bytesPerUnit;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

const formatPercent = (value: number) =>
  value < minimumVisiblePercent && value > 0
    ? "<0.01%"
    : `${value.toFixed(2)}%`;

export const StorageUsageSummary = ({
  usage,
}: {
  usage: WorkspaceStorageUsage;
}) => {
  const usagePercent =
    (usage.totalBytes / freeTierStorageBytes) * percentMultiplier;
  const progressValue = Math.min(percentMultiplier, usagePercent);
  const freeBytesRemaining = Math.max(
    0,
    freeTierStorageBytes - usage.totalBytes
  );

  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-sm">R2 storage</h2>
            <Badge variant="outline">Free tier 10 GB</Badge>
          </div>
          <div className="mt-1 text-muted-foreground text-xs">
            {formatBytes(freeBytesRemaining)} free remaining
          </div>
        </div>
        <div className="text-left md:text-right">
          <div className="font-semibold text-xl">
            {formatBytes(usage.totalBytes)}
          </div>
          <div className="text-muted-foreground text-xs">
            {formatPercent(usagePercent)} used
          </div>
        </div>
      </div>

      <Progress className="mt-4 h-2" value={progressValue} />

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-xs">Private objects</dt>
          <dd className="font-medium">{formatBytes(usage.privateBytes)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">CDN copies</dt>
          <dd className="font-medium">
            {formatBytes(usage.publicBytes)}
            <span className="ml-1 text-muted-foreground text-xs">
              ({usage.cdnCopyCount})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Ready versions</dt>
          <dd className="font-medium">{usage.readyVersionCount}</dd>
        </div>
      </dl>
    </section>
  );
};
