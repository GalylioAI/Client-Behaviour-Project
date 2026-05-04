"use client"

import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ErrorState } from "./error-state"
import { NoDataEmptyState } from "./empty-state"
import type { DataQualityMetrics, LoadingState } from "@/lib/dashboard-types"
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface DataQualitySectionProps {
  data?: DataQualityMetrics
  status?: LoadingState
  error?: string
  onRetry?: () => void
  className?: string
}

function getQualityIcon(fillRate: number) {
  if (fillRate >= 95) return <CheckCircle2 className="h-4 w-4 text-chart-positive" />
  if (fillRate >= 70) return <AlertCircle className="h-4 w-4 text-chart-3" />
  return <XCircle className="h-4 w-4 text-chart-negative" />
}

function getQualityColor(fillRate: number) {
  if (fillRate >= 95) return "bg-chart-positive"
  if (fillRate >= 70) return "bg-chart-3"
  return "bg-chart-negative"
}

function getOverallQualityBadge(coverage: number) {
  if (coverage >= 90)
    return <Badge variant="outline" className="bg-chart-positive/10 text-chart-positive border-chart-positive/30">Excellent</Badge>
  if (coverage >= 75)
    return <Badge variant="outline" className="bg-chart-3/10 text-chart-3 border-chart-3/30">Good</Badge>
  if (coverage >= 50)
    return <Badge variant="outline" className="bg-chart-5/10 text-chart-5 border-chart-5/30">Fair</Badge>
  return <Badge variant="outline" className="bg-chart-negative/10 text-chart-negative border-chart-negative/30">Poor</Badge>
}

export function DataQualitySection({
  data,
  status = "success",
  error,
  onRetry,
  className,
}: DataQualitySectionProps) {
  if (status === "loading") {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-16 w-full" />
            <div className="grid gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === "error") {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <ErrorState
            title="Failed to load data quality"
            message={error || "We couldn't load the data quality metrics."}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.columns.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <NoDataEmptyState onRetry={onRetry} />
        </CardContent>
      </Card>
    )
  }

  // Sort columns by fill rate for display
  const sortedColumns = [...data.columns].sort((a, b) => b.fillRate - a.fillRate)
  const displayColumns = sortedColumns.slice(0, 8)

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-semibold">Data Quality</CardTitle>
            <CardDescription>Column coverage and fill rates</CardDescription>
          </div>
          {getOverallQualityBadge(data.overallCoverage)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          {/* Overall Score */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Overall Coverage ({data.totalColumns} columns)
              </span>
              <span className="text-sm font-medium">{data.overallCoverage}%</span>
            </div>
            <Progress value={data.overallCoverage} className="h-2" />
          </div>

          {/* Individual Columns */}
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">Column Fill Rates</span>
            <div className="grid gap-2">
              {displayColumns.map((col) => (
                <div
                  key={col.column}
                  className="flex items-center gap-3 text-sm"
                >
                  {getQualityIcon(col.fillRate)}
                  <span className="flex-1 truncate font-mono text-xs">
                    {col.column}
                  </span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {col.dataType}
                  </Badge>
                  <div className="flex items-center gap-2 w-[100px]">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", getQualityColor(col.fillRate))}
                        style={{ width: `${col.fillRate}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums w-[40px] text-right">
                      {col.fillRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {data.columns.length > 8 && (
              <span className="text-xs text-muted-foreground">
                +{data.columns.length - 8} more columns
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
