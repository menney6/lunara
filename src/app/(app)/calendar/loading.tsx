import { Skeleton } from "@/components/ui";

export default function CalendarLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading calendar">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Skeleton className="h-[430px] w-full rounded-[28px]" />

      <div className="space-y-2.5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-[136px] w-full rounded-[28px]" />
      </div>

      <Skeleton className="h-24 w-full rounded-[24px]" />
    </div>
  );
}
