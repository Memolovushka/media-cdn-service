import { Progress } from "@workspace/ui/components/progress";
import { TooltipHint } from "@/components/tooltip-hint";
import type { WorkspaceStorageUsage } from "@/server/assets";

const bytesPerUnit = 1024;
const percentMultiplier = 100;
const storageWarningPercent = 80;
const storageDangerPercent = 95;

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

const getMeterTone = (usagePercent: number) => {
  if (usagePercent >= storageDangerPercent) {
    return "danger";
  }

  if (usagePercent >= storageWarningPercent) {
    return "warning";
  }

  return "default";
};

const getMeterClassName = (meterTone: ReturnType<typeof getMeterTone>) => {
  if (meterTone === "danger") {
    return "[&_[data-slot=progress-indicator]]:bg-destructive";
  }

  if (meterTone === "warning") {
    return "[&_[data-slot=progress-indicator]]:bg-amber-500";
  }

  return "";
};

export const StorageUsageSummary = ({
  usage,
}: {
  usage: WorkspaceStorageUsage;
}) => {
  const freeBytesRemaining = Math.max(0, usage.quotaBytes - usage.totalBytes);
  const usagePercent =
    usage.quotaBytes > 0
      ? Math.min(
          percentMultiplier,
          (usage.totalBytes / usage.quotaBytes) * percentMultiplier
        )
      : 0;
  const roundedUsagePercent = Math.round(usagePercent);
  const meterTone = getMeterTone(usagePercent);
  const meterClassName = getMeterClassName(meterTone);

  return (
    <TooltipHint
      content={`${formatBytes(usage.privateBytes)} private, ${formatBytes(
        usage.publicBytes
      )} public CDN copies, ${formatBytes(usage.quotaBytes)} quota`}
    >
      <span className="inline-flex min-w-36 flex-col gap-1 align-middle">
        <span>
          Storage: {formatBytes(usage.totalBytes)} used /{" "}
          {formatBytes(freeBytesRemaining)} left
          {meterTone === "default" ? null : ` (${roundedUsagePercent}%)`}
        </span>
        <Progress
          aria-label={`Storage quota ${roundedUsagePercent}% used`}
          className={`h-0.5 ${meterClassName}`}
          value={usagePercent}
        />
      </span>
    </TooltipHint>
  );
};
