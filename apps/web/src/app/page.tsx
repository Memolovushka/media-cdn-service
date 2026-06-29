import { Badge } from "@workspace/ui/components/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { eq } from "drizzle-orm";
import { DownloadIcon } from "lucide-react";
import { headers } from "next/headers";
import { Fragment } from "react";
import { AccountActions } from "@/components/account-actions";
import { AssetCdnControls } from "@/components/asset-cdn-controls";
import { AssetPreviewDialog } from "@/components/asset-preview-dialog";
import { AssetUploadDialog } from "@/components/asset-upload-dialog";
import {
  AssetTableRowClient,
  FolderTableRowClient,
} from "@/components/file-manager-table-rows";
import { FolderCreateDialog } from "@/components/folder-create-dialog";
import { WorkspaceOnboarding } from "@/components/workspace-onboarding";
import { workspaceMembers, workspaces } from "@/db/schema";
import { listWorkspaceAssets, listWorkspaceFolders } from "@/server/assets";
import { getAppContext } from "@/server/context";

const bytesPerUnit = 1024;
const fileBrowserRootPath = "asset";
const fileBrowserRootLabel = "Main";

const assetStatusLabels = {
  abandoned: "Abandoned",
  failed: "Failed",
  pending: "Pending upload",
  ready: "Ready",
  uploaded: "Processing",
} as const;

const assetStatusVariants = {
  abandoned: "outline",
  failed: "destructive",
  pending: "secondary",
  ready: "default",
  uploaded: "secondary",
} as const;

type AssetStatus = keyof typeof assetStatusLabels;

const getAssetStatusLabel = (status?: string) =>
  status && status in assetStatusLabels
    ? assetStatusLabels[status as AssetStatus]
    : assetStatusLabels.pending;

const getAssetStatusVariant = (status?: string) =>
  status && status in assetStatusVariants
    ? assetStatusVariants[status as AssetStatus]
    : assetStatusVariants.pending;

const formatBytes = (bytes: number) => {
  if (bytes < bytesPerUnit) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / bytesPerUnit;
  let unitIndex = 0;

  while (value >= bytesPerUnit && unitIndex < units.length - 1) {
    value /= bytesPerUnit;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

type DashboardAsset = NonNullable<
  Awaited<ReturnType<typeof listWorkspaceAssets>>
>[number];
type DashboardFolder = NonNullable<
  Awaited<ReturnType<typeof listWorkspaceFolders>>
>[number];

const getParentFolderPath = (folderPath: string) =>
  folderPath.includes("/")
    ? folderPath.slice(0, folderPath.lastIndexOf("/"))
    : "";

const folderHref = (folderPath: string) =>
  folderPath === fileBrowserRootPath
    ? "/"
    : `/?folder=${encodeURIComponent(folderPath)}`;

const getFileBrowserFolderPath = (folderPath?: string) =>
  folderPath?.startsWith(`${fileBrowserRootPath}/`)
    ? folderPath
    : fileBrowserRootPath;

const getFolderBreadcrumbSegments = (folderPath: string) =>
  folderPath.split("/").map((segment, index, segments) => ({
    href: folderHref(segments.slice(0, index + 1).join("/")),
    name:
      index === 0 && segment === fileBrowserRootPath
        ? fileBrowserRootLabel
        : segment,
  }));

const FolderTableRow = ({
  folder,
  workspaceId,
}: {
  folder: DashboardFolder;
  workspaceId: string;
}) => {
  const href = folderHref(folder.path);

  return (
    <FolderTableRowClient
      folderHref={href}
      folderName={folder.name}
      folderPath={folder.path}
      workspaceId={workspaceId}
    />
  );
};

const getAssetUrls = (asset: DashboardAsset) => {
  const latestVersion = "versions" in asset ? asset.versions.at(0) : null;
  const isReady = latestVersion?.uploadStatus === "ready";

  return {
    downloadUrl: isReady
      ? `/api/assets/${asset.id}/download?versionId=${latestVersion.id}`
      : null,
    latestVersion,
    previewUrl: isReady
      ? `/api/assets/${asset.id}/preview?versionId=${latestVersion.id}`
      : null,
  };
};

const AssetTableRow = ({
  asset,
  href,
  selected,
}: {
  asset: DashboardAsset;
  href: string;
  selected: boolean;
}) => {
  const { downloadUrl, latestVersion, previewUrl } = getAssetUrls(asset);

  return (
    <AssetTableRowClient
      downloadUrl={downloadUrl}
      filename={asset.filename}
      href={href}
      mimeType={asset.mimeType}
      previewUrl={previewUrl}
      selected={selected}
      sizeLabel={formatBytes(asset.sizeBytes)}
      statusLabel={getAssetStatusLabel(latestVersion?.uploadStatus)}
      statusVariant={getAssetStatusVariant(latestVersion?.uploadStatus)}
    />
  );
};

const assetHref = ({
  assetId,
  folderPath,
}: {
  assetId: string;
  folderPath: string;
}) => {
  const params = new URLSearchParams();

  if (folderPath) {
    params.set("folder", folderPath);
  }

  params.set("asset", assetId);

  return `/?${params.toString()}`;
};
const AssetDetailsPanel = ({ asset }: { asset?: DashboardAsset | null }) => {
  if (!asset) {
    return (
      <section className="rounded-lg border p-4">
        <div className="flex h-44 items-center justify-center text-center text-muted-foreground text-sm">
          Select a file to manage preview, download, and CDN settings.
        </div>
      </section>
    );
  }

  const latestVersion = "versions" in asset ? asset.versions.at(0) : null;
  const isReady = latestVersion?.uploadStatus === "ready";
  const downloadUrl = isReady
    ? `/api/assets/${asset.id}/download?versionId=${latestVersion.id}`
    : null;
  const previewUrl = isReady
    ? `/api/assets/${asset.id}/preview?versionId=${latestVersion.id}`
    : null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{asset.filename}</div>
          <div className="mt-1 truncate text-muted-foreground text-xs">
            {asset.mimeType} - {formatBytes(asset.sizeBytes)}
          </div>
        </div>
        <Badge variant={getAssetStatusVariant(latestVersion?.uploadStatus)}>
          {getAssetStatusLabel(latestVersion?.uploadStatus)}
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        <AssetPreviewDialog
          disabled={!previewUrl}
          filename={asset.filename}
          mimeType={asset.mimeType}
          previewUrl={previewUrl}
        />
        {downloadUrl ? (
          <Button asChild size="icon" variant="ghost">
            <a href={downloadUrl}>
              <DownloadIcon />
              <span className="sr-only">Download</span>
            </a>
          </Button>
        ) : (
          <Button disabled size="icon" variant="ghost">
            <DownloadIcon />
            <span className="sr-only">Download</span>
          </Button>
        )}
      </div>

      <AssetCdnControls
        assetId={asset.id}
        cdnEnabled={asset.cdnEnabled}
        publicUrl={latestVersion?.publicUrl}
        ready={isReady}
        tags={"tags" in asset ? asset.tags : []}
        workspaceId={asset.workspaceId}
      />
    </section>
  );
};

const FileManager = ({
  assets,
  selectedAsset,
  selectedFolderPath,
  visibleFolders,
  workspaceId,
}: {
  assets: DashboardAsset[];
  selectedAsset?: DashboardAsset | null;
  selectedFolderPath: string;
  visibleFolders: DashboardFolder[];
  workspaceId: string;
}) => {
  const hasFileManagerItems = Boolean(visibleFolders.length || assets.length);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(420px,1fr)_minmax(360px,520px)]">
      <div className="min-h-96 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hasFileManagerItems ? (
              <>
                {visibleFolders.map((folder) => (
                  <FolderTableRow
                    folder={folder}
                    key={folder.id}
                    workspaceId={workspaceId}
                  />
                ))}
                {assets.map((asset) => (
                  <AssetTableRow
                    asset={asset}
                    href={assetHref({
                      assetId: asset.id,
                      folderPath: selectedFolderPath,
                    })}
                    key={asset.id}
                    selected={selectedAsset?.id === asset.id}
                  />
                ))}
              </>
            ) : (
              <TableRow>
                <TableCell
                  className="h-32 text-center text-muted-foreground text-sm"
                  colSpan={4}
                >
                  This folder is empty.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <AssetDetailsPanel asset={selectedAsset} />
    </section>
  );
};

const SetupRequired = ({ message }: { message: string }) => (
  <main className="flex min-h-svh items-center justify-center bg-background p-6">
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Production setup required</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          The app is deployed, but Cloudflare bindings or auth secrets are not
          available yet.
        </p>
        <p className="rounded-md border bg-muted px-3 py-2 font-mono text-xs">
          {message}
        </p>
      </CardContent>
    </Card>
  </main>
);

interface PageProps {
  searchParams?: Promise<{
    asset?: string;
    folder?: string;
  }>;
}

const Page = async ({ searchParams }: PageProps) => {
  const params = await searchParams;
  const selectedFolderPath = getFileBrowserFolderPath(params?.folder);
  const selectedAssetId = params?.asset ?? "";
  const ctx = await getAppContext().catch(() => null);
  const session = ctx
    ? await ctx.auth.api
        .getSession({
          headers: await headers(),
        })
        .catch((error: unknown) => {
          console.error(error);
          return null;
        })
    : null;

  if (!ctx) {
    return <SetupRequired message="Missing Cloudflare runtime context." />;
  }

  if (!session) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Media CDN Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Sign in to manage private assets, uploads, and CDN publishing.
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <a href="/auth?mode=signin">Sign in</a>
              </Button>
              <Button asChild variant="outline">
                <a href="/auth?mode=signup">Create account</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const memberships = await ctx.db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, session.user.id));

  const activeWorkspace = memberships.at(0);
  const assets = activeWorkspace
    ? await listWorkspaceAssets({
        db: ctx.db,
        folderPath: selectedFolderPath,
        workspaceId: activeWorkspace.workspaceId,
        userId: session.user.id,
      })
    : [];
  const folders = activeWorkspace
    ? await listWorkspaceFolders({
        db: ctx.db,
        workspaceId: activeWorkspace.workspaceId,
        userId: session.user.id,
      })
    : [];
  const visibleFolders =
    folders?.filter((folder) => {
      const parentPath = getParentFolderPath(folder.path);

      return parentPath === selectedFolderPath;
    }) ?? [];
  const dashboardAssets = assets ?? [];
  const folderBreadcrumbSegments =
    getFolderBreadcrumbSegments(selectedFolderPath);
  const selectedAsset =
    dashboardAssets.find((asset) => asset.id === selectedAssetId) ??
    dashboardAssets.at(0);
  const cdnReadyAssetCount = dashboardAssets.filter(
    (asset) => asset.cdnEnabled
  ).length;

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-semibold text-2xl tracking-normal">
              Media CDN
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
              <span>{session.user.email}</span>
              {activeWorkspace ? (
                <Badge variant="outline">{activeWorkspace.workspaceName}</Badge>
              ) : null}
              {activeWorkspace ? (
                <>
                  <span>{dashboardAssets.length} files</span>
                  <span>{cdnReadyAssetCount} CDN-ready</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AssetUploadDialog
              disabled={!activeWorkspace}
              folderPath={selectedFolderPath}
              workspaceId={activeWorkspace?.workspaceId}
            />
            <AccountActions email={session.user.email} />
          </div>
        </header>

        {activeWorkspace ? (
          <>
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <Breadcrumb>
                  <BreadcrumbList>
                    {folderBreadcrumbSegments.map((segment, index) => {
                      const isCurrent =
                        index === folderBreadcrumbSegments.length - 1;

                      return (
                        <Fragment key={segment.href}>
                          {index > 0 ? <BreadcrumbSeparator /> : null}
                          <BreadcrumbItem>
                            {isCurrent ? (
                              <BreadcrumbPage>{segment.name}</BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink href={segment.href}>
                                {segment.name}
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                        </Fragment>
                      );
                    })}
                  </BreadcrumbList>
                </Breadcrumb>
                <FolderCreateDialog
                  disabled={!activeWorkspace}
                  parentPath={selectedFolderPath}
                  workspaceId={activeWorkspace?.workspaceId}
                />
              </div>
            </section>

            <FileManager
              assets={dashboardAssets}
              selectedAsset={selectedAsset}
              selectedFolderPath={selectedFolderPath}
              visibleFolders={visibleFolders}
              workspaceId={activeWorkspace.workspaceId}
            />
          </>
        ) : (
          <WorkspaceOnboarding />
        )}
      </div>
    </main>
  );
};

export default Page;
