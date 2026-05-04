"use client"

import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ErrorState } from "./error-state"
import { NoDataEmptyState } from "./empty-state"
import type { BehavioralSegment, LoadingState } from "@/lib/dashboard-types"
import { TrendingUp, TrendingDown, Minus, Users } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface BehavioralSegmentsProps {
  data?: BehavioralSegment[]
  status?: LoadingState
  error?: string
  onRetry?: () => void
  onSegmentClick?: (segment: BehavioralSegment) => void
  className?: string
}

function SegmentCard({
  segment,
  onClick,
}: {
  segment: BehavioralSegment
  onClick?: () => void
}) {
  const getTrendIcon = () => {
    if (!segment.trend) return null
    switch (segment.trend.direction) {
      case "up":
        return <TrendingUp className="h-3.5 w-3.5 text-chart-positive" />
      case "down":
        return <TrendingDown className="h-3.5 w-3.5 text-chart-negative" />
      default:
        return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
    }
  }

  const getTrendColor = () => {
    if (!segment.trend) return "text-muted-foreground"
    switch (segment.trend.direction) {
      case "up":
        return "text-chart-positive"
      case "down":
        return "text-chart-negative"
      default:
        return "text-muted-foreground"
    }
  }

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/20",
        onClick && "hover:bg-accent/50"
      )}
      onClick={onClick}
    >
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h3 className="font-semibold text-sm">{segment.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {segment.description}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {segment.trend ? (
                <>
                  {getTrendIcon()}
                  <span className={cn("text-xs font-medium", getTrendColor())}>
                    {segment.trend.value > 0 ? "+" : ""}
                    {segment.trend.value}%
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium tabular-nums">
                {segment.userCount.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                ({segment.percentage}%)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {segment.traits.slice(0, 3).map((trait, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="text-xs font-normal"
              >
                {trait}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SegmentCardSkeleton() {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-5 w-28" />
          <div className="flex gap-1">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function BehavioralSegments({
  data,
  status = "success",
  error,
  onRetry,
  onSegmentClick,
  className,
}: BehavioralSegmentsProps) {
  if (status === "loading") {
    return (
      <section className={cn("flex flex-col gap-4", className)}>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SegmentCardSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  if (status === "error") {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <ErrorState
            title="Failed to load segments"
            message={error || "We couldn't load the behavioral segments."}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <NoDataEmptyState onRetry={onRetry} />
        </CardContent>
      </Card>
    )
  }

  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Behavioral Segments</h2>
        <p className="text-sm text-muted-foreground">
          User segments based on shopping behavior patterns
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {data.map((segment) => (
          <SegmentCard
            key={segment.id}
            segment={segment}
            onClick={onSegmentClick ? () => onSegmentClick(segment) : undefined}
          />
        ))}
      </div>
    </section>
  )
}
