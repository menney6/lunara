import { Skeleton } from "@/components/ui";

export default function PregnancyLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading pregnancy mode">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Skeleton className="h-[224px] w-full rounded-[28px]" />

      <div className="space-y-2.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-[230px] w-full rounded-[28px]" />
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-5 w-36" />
        <div className="flex gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[96px] w-[104px] rounded-2xl" />
          ))}
        </div>
      </div>

      <Skeleton className="h-32 w-full rounded-[28px]" />
      <Skeleton className="h-40 w-full rounded-[28px]" />
    </div>
  );
}
