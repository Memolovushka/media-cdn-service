import { Skeleton } from "@workspace/ui/components/skeleton";

const tableRows = Array.from({ length: 7 }, (_, index) => `row-${index}`);
const toolbarButtons = Array.from(
  { length: 5 },
  (_, index) => `toolbar-${index}`
);

const Loading = () => (
  <main className="min-h-svh bg-muted/20">
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b bg-background/70 pb-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <Skeleton className="h-6 w-28" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Skeleton className="size-9" />
          <Skeleton className="h-9 w-28" />
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 rounded-lg border bg-background shadow-sm">
          <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="mt-2 flex items-center gap-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {toolbarButtons.map((buttonKey) => (
                <Skeleton className="h-8 w-24" key={buttonKey} />
              ))}
            </div>
          </div>

          <div className="overflow-hidden">
            <div className="grid grid-cols-[minmax(220px,1.5fr)_120px_110px_90px_132px] border-b px-3 py-2 text-xs">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-9" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="ml-auto h-4 w-14" />
            </div>
            <div className="divide-y">
              {tableRows.map((rowKey) => (
                <div
                  className="grid h-12 grid-cols-[minmax(220px,1.5fr)_120px_110px_90px_132px] items-center px-3"
                  key={rowKey}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Skeleton className="size-7" />
                    <Skeleton className="h-4 w-44" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-12" />
                  <div className="flex justify-end gap-1">
                    <Skeleton className="size-8" />
                    <Skeleton className="size-8" />
                    <Skeleton className="size-8" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="hidden flex-col gap-3 lg:flex">
          <section className="flex flex-col gap-3 rounded-lg border bg-background p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-2 h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
            <div className="border-b pb-3">
              <Skeleton className="mb-2 h-3 w-14" />
              <Skeleton className="h-7 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
            <Skeleton className="h-24 w-full" />
          </section>
        </aside>
      </section>
    </div>
  </main>
);

export default Loading;
