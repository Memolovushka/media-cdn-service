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
import { eq } from "drizzle-orm";
import type { Route } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Fragment } from "react";
import { AccountActions } from "@/components/account-actions";
import { AssetUploadDialog } from "@/components/asset-upload-dialog";
import { FileManager } from "@/components/file-manager";
import { StorageUsageSummary } from "@/components/storage-usage-summary";
import { WorkspaceOnboarding } from "@/components/workspace-onboarding";
import { workspaceMembers, workspaces } from "@/db/schema";
import {
  getWorkspaceStorageUsage,
  listWorkspaceAssets,
  listWorkspaceFolders,
} from "@/server/assets";
import { getAppContext } from "@/server/context";

const fileBrowserRootPath = "asset";
const fileBrowserRootLabel = "Main";

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
  const storageUsage = activeWorkspace
    ? await getWorkspaceStorageUsage({
        db: ctx.db,
        workspaceId: activeWorkspace.workspaceId,
        userId: session.user.id,
      })
    : null;
  const visibleFolders =
    folders?.filter((folder) => {
      const parentPath = getParentFolderPath(folder.path);

      return parentPath === selectedFolderPath;
    }) ?? [];
  const dashboardAssets = assets ?? [];
  const folderBreadcrumbSegments =
    getFolderBreadcrumbSegments(selectedFolderPath);
  const isRootFolder = selectedFolderPath === fileBrowserRootPath;
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
                  {storageUsage ? (
                    <StorageUsageSummary usage={storageUsage} />
                  ) : null}
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
                {isRootFolder ? (
                  <div />
                ) : (
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
                                <BreadcrumbLink asChild>
                                  <Link href={segment.href as Route}>
                                    {segment.name}
                                  </Link>
                                </BreadcrumbLink>
                              )}
                            </BreadcrumbItem>
                          </Fragment>
                        );
                      })}
                    </BreadcrumbList>
                  </Breadcrumb>
                )}
              </div>
            </section>
            <FileManager
              allFolders={folders ?? []}
              assets={dashboardAssets}
              selectedAssetId={selectedAssetId}
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
