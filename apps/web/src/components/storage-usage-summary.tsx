import { TooltipHint } from "@/components/tooltip-hint";
import type { WorkspaceStorageUsage } from "@/server/assets";

const bytesPerUnit = 1024;

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

export const StorageUsageSummary = ({
  usage,
}: {
  usage: WorkspaceStorageUsage;
}) => {
  const freeBytesRemaining = Math.max(0, usage.quotaBytes - usage.totalBytes);

  return (
    <TooltipHint
      content={`${formatBytes(usage.privateBytes)} private, ${formatBytes(
        usage.publicBytes
      )} public CDN copies, ${formatBytes(usage.quotaBytes)} quota`}
    >
      <span>
        Storage: {formatBytes(usage.totalBytes)} used /{" "}
        {formatBytes(freeBytesRemaining)} left
      </span>
    </TooltipHint>
  );
};
