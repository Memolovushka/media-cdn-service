import { Badge } from "@workspace/ui/components/badge";
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
import { DownloadIcon, FileIcon, KeyRoundIcon, SearchIcon } from "lucide-react";
import { headers } from "next/headers";
import { AssetCdnControls } from "@/components/asset-cdn-controls";
import { AssetUploadDialog } from "@/components/asset-upload-dialog";
import { WorkspaceOnboarding } from "@/components/workspace-onboarding";
import { workspaceMembers, workspaces } from "@/db/schema";
import { listWorkspaceAssets } from "@/server/assets";
import { getAppContext } from "@/server/context";

const bytesPerUnit = 1024;

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

const Page = async () => {
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
        workspaceId: activeWorkspace.workspaceId,
        userId: session.user.id,
      })
    : [];

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
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="outline">
              <SearchIcon />
              <span className="sr-only">Search</span>
            </Button>
            <Button size="icon" variant="outline">
              <KeyRoundIcon />
              <span className="sr-only">API tokens</span>
            </Button>
            <AssetUploadDialog
              disabled={!activeWorkspace}
              workspaceId={activeWorkspace?.workspaceId}
            />
          </div>
        </header>

        {activeWorkspace ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Assets</CardTitle>
                </CardHeader>
                <CardContent className="font-semibold text-2xl">
                  {assets?.length ?? 0}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Workspace</CardTitle>
                </CardHeader>
                <CardContent className="truncate font-medium">
                  {activeWorkspace.workspaceSlug}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">CDN-ready</CardTitle>
                </CardHeader>
                <CardContent className="font-semibold text-2xl">
                  {assets?.filter((asset) => asset.cdnEnabled).length ?? 0}
                </CardContent>
              </Card>
            </section>

            <section className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="min-w-80">CDN</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets?.length ? (
                    assets.map((asset) => {
                      const latestVersion =
                        "versions" in asset ? asset.versions.at(0) : null;
                      const downloadUrl =
                        latestVersion?.uploadStatus === "ready"
                          ? `/api/assets/${asset.id}/download?versionId=${latestVersion.id}`
                          : null;

                      return (
                        <TableRow key={asset.id}>
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-3">
                              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {asset.filename}
                                </div>
                                <div className="truncate text-muted-foreground text-xs">
                                  {asset.mimeType}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getAssetStatusVariant(
                                latestVersion?.uploadStatus
                              )}
                            >
                              {getAssetStatusLabel(latestVersion?.uploadStatus)}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatBytes(asset.sizeBytes)}</TableCell>
                          <TableCell>
                            <AssetCdnControls
                              assetId={asset.id}
                              cdnEnabled={asset.cdnEnabled}
                              publicUrl={latestVersion?.publicUrl}
                              ready={latestVersion?.uploadStatus === "ready"}
                              tags={"tags" in asset ? asset.tags : []}
                            />
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        className="h-32 text-center text-muted-foreground text-sm"
                        colSpan={5}
                      >
                        No assets uploaded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </section>
          </>
        ) : (
          <WorkspaceOnboarding />
        )}
      </div>
    </main>
  );
};

export default Page;
