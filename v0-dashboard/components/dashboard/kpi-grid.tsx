"use client"

import { cn } from "@/lib/utils"
import { StatCard, StatCardSkeleton } from "./stat-card"
import { ErrorState } from "./error-state"
import { NoDataEmptyState } from "./empty-state"
import type { KPIData, LoadingState } from "@/lib/dashboard-types"

interface KPIGridProps {
  data?: KPIData[]
  status?: LoadingState
  error?: string
  onRetry?: () => void
  className?: string
}

export function KPIGrid({
  data,
  status = "success",
  error,
  onRetry,
  className,
}: KPIGridProps) {
  if (status === "loading") {
    return (
      <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border bg-card p-6">
        <ErrorState
          title="Failed to load KPIs"
          message={error || "We couldn't load the key metrics. Please try again."}
          onRetry={onRetry}
        />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <NoDataEmptyState onRetry={onRetry} />
      </div>
    )
  }

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {data.map((kpi) => (
        <StatCard key={kpi.id} data={kpi} />
      ))}
    </div>
  )
}
