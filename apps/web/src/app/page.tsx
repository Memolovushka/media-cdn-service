import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { AccountActions } from "@/components/account-actions";
import { FileManager } from "@/components/file-manager";
import { StorageUsageSummary } from "@/components/storage-usage-summary";
import { ThemeToggle } from "@/components/theme-toggle";
import { TooltipHint } from "@/components/tooltip-hint";
import { WorkspaceMenu } from "@/components/workspace-menu";
import { WorkspaceOnboarding } from "@/components/workspace-onboarding";
import { workspaceMembers, workspaces } from "@/db/schema";
import {
  getWorkspaceStorageUsage,
  listWorkspaceActivity,
  listWorkspaceAssets,
  listWorkspaceFolders,
} from "@/server/assets";
import { getAppContext } from "@/server/context";

const fileBrowserRootPath = "asset";

const getParentFolderPath = (folderPath: string) =>
  folderPath.includes("/")
    ? folderPath.slice(0, folderPath.lastIndexOf("/"))
    : "";

const getFileBrowserFolderPath = (folderPath?: string) =>
  folderPath?.startsWith(`${fileBrowserRootPath}/`)
    ? folderPath
    : fileBrowserRootPath;

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
    workspace?: string;
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
              <TooltipHint content="Sign in to an existing account">
                <Button asChild>
                  <a href="/auth?mode=signin">Sign in</a>
                </Button>
              </TooltipHint>
              <TooltipHint content="Create a new account">
                <Button asChild variant="outline">
                  <a href="/auth?mode=signup">Create account</a>
                </Button>
              </TooltipHint>
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

  const activeWorkspace =
    memberships.find(
      (membership) => membership.workspaceId === params?.workspace
    ) ?? memberships.at(0);
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
  const activityEvents = activeWorkspace
    ? await listWorkspaceActivity({
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
  const cdnReadyAssetCount = dashboardAssets.filter(
    (asset) => asset.cdnEnabled
  ).length;

  return (
    <main className="min-h-svh bg-muted/20">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b bg-background/70 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="font-semibold text-lg tracking-normal">Media CDN</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
              {activeWorkspace ? (
                <WorkspaceMenu
                  activeWorkspaceId={activeWorkspace.workspaceId}
                  workspaces={memberships.map((membership) => ({
                    id: membership.workspaceId,
                    name: membership.workspaceName,
                  }))}
                />
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
          <div className="flex shrink-0 flex-wrap gap-2">
            <ThemeToggle />
            <AccountActions email={session.user.email} />
          </div>
        </header>

        {activeWorkspace ? (
          <FileManager
            activityEvents={activityEvents ?? []}
            allFolders={folders ?? []}
            assets={dashboardAssets}
            selectedAssetId={selectedAssetId}
            selectedFolderPath={selectedFolderPath}
            visibleFolders={visibleFolders}
            workspaceId={activeWorkspace.workspaceId}
          />
        ) : (
          <WorkspaceOnboarding />
        )}
      </div>
    </main>
  );
};

export default Page;
