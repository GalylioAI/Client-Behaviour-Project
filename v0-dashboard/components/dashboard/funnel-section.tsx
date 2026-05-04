"use client"

import { cn } from "@/lib/utils"
import { ChartCard } from "./chart-card"
import { ErrorState } from "./error-state"
import { NoDataEmptyState } from "./empty-state"
import type { FunnelData, LoadingState } from "@/lib/dashboard-types"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, Cell, LabelList } from "recharts"

const chartConfig = {
  value: {
    label: "Users",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

interface FunnelSectionProps {
  data?: FunnelData
  status?: LoadingState
  error?: string
  onRetry?: () => void
  onRefresh?: () => void
  className?: string
}

export function FunnelSection({
  data,
  status = "success",
  error,
  onRetry,
  onRefresh,
  className,
}: FunnelSectionProps) {
  const chartData = (data?.stages || []).map((stage) => ({
    name: stage.name,
    value: stage.value,
    conversionRate: stage.conversionRate,
    dropoff: stage.dropoff,
  }))

  const renderContent = () => {
    if (status === "error") {
      return (
        <ErrorState
          title="Failed to load funnel"
          message={error || "We couldn't load the funnel data."}
          onRetry={onRetry}
        />
      )
    }

    if (!data || data.stages.length === 0) {
      return <NoDataEmptyState onRetry={onRetry} />
    }

    return (
      <div className="flex flex-col gap-4">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 60, left: 10, bottom: 10 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              width={100}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => (
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">
                        {Number(value).toLocaleString()} users
                      </span>
                      <span className="text-muted-foreground">
                        {item.payload.conversionRate}% conversion
                      </span>
                      {item.payload.dropoff > 0 && (
                        <span className="text-chart-negative">
                          {item.payload.dropoff}% drop-off
                        </span>
                      )}
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={`var(--chart-1)`}
                  fillOpacity={1 - index * 0.15}
                />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value: number) =>
                  value >= 1000
                    ? `${(value / 1000).toFixed(1)}K`
                    : value.toString()
                }
                className="fill-foreground text-xs"
              />
            </Bar>
          </BarChart>
        </ChartContainer>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">
              Overall Conversion Rate
            </span>
            <span className="text-2xl font-semibold">
              {data.totalConversionRate}%
            </span>
          </div>
          <div className="flex gap-4">
            {data.stages.slice(0, 3).map((stage, index) => (
              <div key={stage.id} className="flex flex-col gap-0.5 text-right">
                <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                  {stage.name}
                </span>
                <span className="text-sm font-medium">
                  {stage.conversionRate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <ChartCard
      title="Conversion Funnel"
      description="User journey from product view to purchase"
      onRefresh={onRefresh}
      isLoading={status === "loading"}
      className={className}
    >
      {renderContent()}
    </ChartCard>
  )
}
