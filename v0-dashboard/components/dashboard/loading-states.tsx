import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface SectionSkeletonProps {
  className?: string
}

export function KPIGridSkeleton({ className }: SectionSkeletonProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[100px] rounded-xl" />
      ))}
    </div>
  )
}

export function ChartSectionSkeleton({ className }: SectionSkeletonProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-6", className)}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>
        <Skeleton className="h-[250px] w-full" />
      </div>
    </div>
  )
}

export function TableSectionSkeleton({ className }: SectionSkeletonProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-6", className)}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-24 rounded" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SegmentGridSkeleton({ className }: SectionSkeletonProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[140px] rounded-xl" />
      ))}
    </div>
  )
}

export function InsightsGridSkeleton({ className }: SectionSkeletonProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[120px] rounded-xl" />
      ))}
    </div>
  )
}

export function DashboardHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-[200px]" />
        <Skeleton className="h-9 w-[140px]" />
      </div>
    </div>
  )
}

export function FullDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8">
      <DashboardHeaderSkeleton />
      <KPIGridSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSectionSkeleton />
        <ChartSectionSkeleton />
      </div>
      <TableSectionSkeleton />
      <SegmentGridSkeleton />
    </div>
  )
}
