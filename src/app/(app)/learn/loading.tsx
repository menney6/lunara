import { Skeleton } from "@/components/ui";

/** Route-level skeleton for `/learn` and everything nested beneath it. */
export default function LearnLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading articles">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-8 w-60 rounded-xl" />
        <Skeleton className="h-5 w-full max-w-xs" />
      </div>

      <div className="flex gap-3 overflow-hidden">
        <Skeleton className="h-44 w-[238px] shrink-0 rounded-3xl" />
        <Skeleton className="h-44 w-[238px] shrink-0 rounded-3xl" />
      </div>

      <div className="flex gap-2.5 overflow-hidden">
        <Skeleton className="h-28 w-[170px] shrink-0 rounded-2xl" />
        <Skeleton className="h-28 w-[170px] shrink-0 rounded-2xl" />
        <Skeleton className="h-28 w-[170px] shrink-0 rounded-2xl" />
      </div>

      <Skeleton className="h-12 rounded-2xl" />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    </div>
  );
}
