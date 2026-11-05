import { Skeleton } from "@/components/ui";

export default function InsightsLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading insights">
      <div>
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-80 w-full rounded-[28px]" />
      <Skeleton className="h-64 w-full rounded-[28px]" />
      <Skeleton className="h-72 w-full rounded-[28px]" />
    </div>
  );
}
