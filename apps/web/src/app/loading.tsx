import { Skeleton } from "@workspace/ui/components/skeleton";

const tableSkeletonCells = Array.from(
  { length: 24 },
  (_, index) => `cell-${index}`
);

const Loading = () => (
  <main className="min-h-svh bg-background">
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </header>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-28" />
      </div>
      <section className="grid gap-4 lg:grid-cols-[minmax(420px,1fr)_minmax(360px,520px)]">
        <div className="min-h-96 rounded-lg border p-4">
          <div className="grid grid-cols-[1fr_120px_90px_80px_40px] gap-4">
            {tableSkeletonCells.map((cell) => (
              <Skeleton className="h-5" key={cell} />
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </section>
    </div>
  </main>
);

export default Loading;
