"use client"

import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ErrorState } from "./error-state"
import { NoDataEmptyState } from "./empty-state"
import type { PropensityMetrics, LoadingState } from "@/lib/dashboard-types"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts"
import { Brain, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

const chartConfig = {
  importance: {
    label: "Importance",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

interface MLPropensitySectionProps {
  data?: PropensityMetrics
  status?: LoadingState
  error?: string
  onRetry?: () => void
  className?: string
}

function getDirectionIcon(direction: "positive" | "negative" | "neutral") {
  switch (direction) {
    case "positive":
      return <TrendingUp className="h-3.5 w-3.5 text-chart-positive" />
    case "negative":
      return <TrendingDown className="h-3.5 w-3.5 text-chart-negative" />
    default:
      return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-chart-positive"
  if (score >= 50) return "text-chart-3"
  return "text-chart-negative"
}

function getScoreBadge(score: number) {
  if (score >= 70) return <Badge className="bg-chart-positive/10 text-chart-positive border-chart-positive/30">High</Badge>
  if (score >= 50) return <Badge className="bg-chart-3/10 text-chart-3 border-chart-3/30">Medium</Badge>
  return <Badge className="bg-chart-negative/10 text-chart-negative border-chart-negative/30">Low</Badge>
}

export function MLPropensitySection({
  data,
  status = "success",
  error,
  onRetry,
  className,
}: MLPropensitySectionProps) {
  if (status === "loading") {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[280px]" />
            <Skeleton className="h-[280px]" />
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
            title="Failed to load ML insights"
            message={error || "We couldn't load the propensity model data."}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <NoDataEmptyState onRetry={onRetry} />
        </CardContent>
      </Card>
    )
  }

  const chartData = data.featureImportance.slice(0, 6).map((f) => ({
    name: f.feature,
    importance: Math.round(f.importance * 100),
    direction: f.direction,
  }))

  const totalUsers = data.highPropensityUsers + data.mediumPropensityUsers + data.lowPropensityUsers

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-base font-semibold">
                Purchase Propensity Model
              </CardTitle>
              <CardDescription>
                ML-powered prediction of purchase likelihood
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            AI-Powered
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Score Overview */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Model Confidence Score
                </span>
                {getScoreBadge(data.overallScore)}
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-4xl font-bold", getScoreColor(data.overallScore))}>
                  {data.overallScore}%
                </span>
              </div>
              <Progress value={data.overallScore} className="h-2" />
              {(data.modelLabel || data.secondaryMetricLabel) && (
                <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                  {data.modelLabel ? <span>Model: {data.modelLabel}</span> : null}
                  {data.secondaryMetricLabel && data.secondaryMetricValue != null ? (
                    <span>
                      {data.secondaryMetricLabel}: {data.secondaryMetricValue}%
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium">User Distribution</span>
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-chart-positive" />
                    <span className="text-sm">High Propensity</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {data.highPropensityUsers.toLocaleString()}{" "}
                    <span className="text-muted-foreground">
                      ({((data.highPropensityUsers / totalUsers) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-chart-3" />
                    <span className="text-sm">Medium Propensity</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {data.mediumPropensityUsers.toLocaleString()}{" "}
                    <span className="text-muted-foreground">
                      ({((data.mediumPropensityUsers / totalUsers) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-chart-5" />
                    <span className="text-sm">Low Propensity</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {data.lowPropensityUsers.toLocaleString()}{" "}
                    <span className="text-muted-foreground">
                      ({((data.lowPropensityUsers / totalUsers) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Importance Chart */}
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">Top Feature Importance</span>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide domain={[0, 30]} />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-medium">{value}% importance</span>
                      )}
                    />
                  }
                />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.direction === "positive" ? "var(--chart-positive)" : "var(--chart-negative)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-chart-positive" />
                Positive impact
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-chart-negative" />
                Negative impact
              </div>
            </div>
            {data.note ? (
              <p className="text-xs leading-5 text-muted-foreground">{data.note}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
