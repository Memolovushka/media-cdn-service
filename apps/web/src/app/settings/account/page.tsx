import { Button } from "@workspace/ui/components/button";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountSettingsForm } from "@/components/account-settings-form";
import { getAppContext } from "@/server/context";

const AccountSettingsPage = async () => {
  const ctx = await getAppContext();
  const session = await ctx.auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth?mode=signin");
  }

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-semibold text-2xl tracking-normal">
              Account settings
            </h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Manage sign-in and account access.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href="/">
              <ArrowLeftIcon />
              Dashboard
            </a>
          </Button>
        </header>

        <AccountSettingsForm
          email={session.user.email}
          name={session.user.name}
        />
      </div>
    </main>
  );
};

export default AccountSettingsPage;
