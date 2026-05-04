"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ErrorState } from "./error-state"
import { NoDataEmptyState } from "./empty-state"
import type { ProductInsight, LoadingState } from "@/lib/dashboard-types"
import { Lightbulb, AlertTriangle, Info, CheckCircle, ArrowRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface ProductInsightsProps {
  data?: ProductInsight[]
  status?: LoadingState
  error?: string
  onRetry?: () => void
  onActionClick?: (insight: ProductInsight) => void
  className?: string
}

function getInsightIcon(type: ProductInsight["type"]) {
  switch (type) {
    case "opportunity":
      return <Lightbulb className="h-4 w-4" />
    case "warning":
      return <AlertTriangle className="h-4 w-4" />
    case "success":
      return <CheckCircle className="h-4 w-4" />
    default:
      return <Info className="h-4 w-4" />
  }
}

function getInsightStyles(type: ProductInsight["type"]) {
  switch (type) {
    case "opportunity":
      return {
        bg: "bg-chart-3/10",
        border: "border-chart-3/30",
        icon: "text-chart-3",
        badge: "bg-chart-3/10 text-chart-3 border-chart-3/30",
      }
    case "warning":
      return {
        bg: "bg-chart-negative/10",
        border: "border-chart-negative/30",
        icon: "text-chart-negative",
        badge: "bg-chart-negative/10 text-chart-negative border-chart-negative/30",
      }
    case "success":
      return {
        bg: "bg-chart-positive/10",
        border: "border-chart-positive/30",
        icon: "text-chart-positive",
        badge: "bg-chart-positive/10 text-chart-positive border-chart-positive/30",
      }
    default:
      return {
        bg: "bg-primary/10",
        border: "border-primary/30",
        icon: "text-primary",
        badge: "bg-primary/10 text-primary border-primary/30",
      }
  }
}

function InsightCard({
  insight,
  onActionClick,
}: {
  insight: ProductInsight
  onActionClick?: () => void
}) {
  const styles = getInsightStyles(insight.type)

  return (
    <Card className={cn("border", styles.border)}>
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className={cn("rounded-lg p-2", styles.bg)}>
                <span className={styles.icon}>{getInsightIcon(insight.type)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-sm leading-tight">
                  {insight.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {insight.description}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {insight.metric && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  {insight.metric.label}
                </span>
                <span className="text-sm font-semibold">{insight.metric.value}</span>
              </div>
            )}
            {insight.action && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={onActionClick}
              >
                {insight.action.label}
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InsightCardSkeleton() {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ProductInsights({
  data,
  status = "success",
  error,
  onRetry,
  onActionClick,
  className,
}: ProductInsightsProps) {
  if (status === "loading") {
    return (
      <section className={cn("flex flex-col gap-4", className)}>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <InsightCardSkeleton key={i} />
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
            title="Failed to load insights"
            message={error || "We couldn't load the product insights."}
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
        <h2 className="text-base font-semibold">Product Insights</h2>
        <p className="text-sm text-muted-foreground">
          AI-generated recommendations and alerts based on your data
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onActionClick={onActionClick ? () => onActionClick(insight) : undefined}
          />
        ))}
      </div>
    </section>
  )
}
