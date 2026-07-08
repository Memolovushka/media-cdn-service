"use client";

const bytesPerKilobyte = 1024;
const kilobytesPerMegabyte = 1024;
export const maxUploadMegabytes = 250;
const maxUploadBytes =
  maxUploadMegabytes * kilobytesPerMegabyte * bytesPerKilobyte;
const progressIntentCreated = 35;
const progressContentUploaded = 75;
const progressComplete = 100;
const progressPercentDenominator = 100;
const allowedMimePrefixes = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "text/plain",
];

interface UploadIntentResponse {
  assetId: string;
  upload: {
    method: "PUT";
    url: string;
  };
  versionId: string;
}

const isAllowedMimeType = (mimeType: string) =>
  allowedMimePrefixes.some((prefix) =>
    prefix.endsWith("/") ? mimeType.startsWith(prefix) : mimeType === prefix
  );

const getErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? "Upload failed";
};

export const uploadAsset = async ({
  cdnEnabled,
  file,
  folderPath,
  onProgress,
  workspaceId,
}: {
  cdnEnabled: boolean;
  file: File;
  folderPath?: string;
  onProgress: (value: number) => void;
  workspaceId: string;
}) => {
  if (file.size > maxUploadBytes) {
    throw new Error(`File is larger than ${maxUploadMegabytes} MB`);
  }

  if (!isAllowedMimeType(file.type)) {
    throw new Error("MIME type is not allowed");
  }

  const intentResponse = await fetch("/api/assets/uploads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workspaceId,
      filename: file.name,
      folderPath,
      mimeType: file.type,
      sizeBytes: file.size,
      cdnEnabled,
    }),
  });

  if (!intentResponse.ok) {
    throw new Error(await getErrorMessage(intentResponse));
  }

  const intent = (await intentResponse.json()) as UploadIntentResponse;
  onProgress(progressIntentCreated);

  const contentResponse = await fetch(intent.upload.url, {
    method: intent.upload.method,
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!contentResponse.ok) {
    throw new Error(await getErrorMessage(contentResponse));
  }

  onProgress(progressContentUploaded);

  const completeResponse = await fetch(
    `/api/assets/${intent.assetId}/complete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ versionId: intent.versionId }),
    }
  );

  if (!completeResponse.ok) {
    throw new Error(await getErrorMessage(completeResponse));
  }

  onProgress(progressComplete);
};

export const replaceAssetVersion = async ({
  assetId,
  expectedMimeType,
  file,
  onProgress,
}: {
  assetId: string;
  expectedMimeType: string;
  file: File;
  onProgress: (value: number) => void;
}) => {
  if (file.size > maxUploadBytes) {
    throw new Error(`File is larger than ${maxUploadMegabytes} MB`);
  }

  if (file.type !== expectedMimeType) {
    throw new Error("Replacement file must keep the same MIME type");
  }

  const intentResponse = await fetch(`/api/assets/${assetId}/versions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });

  if (!intentResponse.ok) {
    throw new Error(await getErrorMessage(intentResponse));
  }

  const intent = (await intentResponse.json()) as UploadIntentResponse;
  onProgress(progressIntentCreated);

  const contentResponse = await fetch(intent.upload.url, {
    method: intent.upload.method,
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!contentResponse.ok) {
    throw new Error(await getErrorMessage(contentResponse));
  }

  onProgress(progressContentUploaded);

  const completeResponse = await fetch(
    `/api/assets/${intent.assetId}/complete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ versionId: intent.versionId }),
    }
  );

  if (!completeResponse.ok) {
    throw new Error(await getErrorMessage(completeResponse));
  }

  onProgress(progressComplete);
};

export const uploadFilesSequentially = async ({
  cdnEnabled,
  files,
  folderPath,
  onFileStart,
  onProgress,
  workspaceId,
}: {
  cdnEnabled: boolean;
  files: File[];
  folderPath?: string;
  onFileStart: (file: File) => void;
  onProgress: (value: number) => void;
  workspaceId: string;
}) => {
  for (const [index, file] of files.entries()) {
    const baseProgress = (index / files.length) * progressComplete;
    const progressShare = progressComplete / files.length;

    onFileStart(file);
    await uploadAsset({
      cdnEnabled,
      file,
      folderPath,
      onProgress: (value) =>
        onProgress(
          Math.round(
            baseProgress + (value / progressPercentDenominator) * progressShare
          )
        ),
      workspaceId,
    });
  }
};
