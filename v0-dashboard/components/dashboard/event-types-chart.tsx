"use client"

import { cn } from "@/lib/utils"
import { ChartCard } from "./chart-card"
import { ErrorState } from "./error-state"
import { NoDataEmptyState } from "./empty-state"
import type { EventTypeData, LoadingState } from "@/lib/dashboard-types"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"

const chartConfig = {
  count: {
    label: "Events",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

interface EventTypesChartProps {
  data?: EventTypeData[]
  status?: LoadingState
  error?: string
  onRetry?: () => void
  onRefresh?: () => void
  className?: string
}

export function EventTypesChart({
  data,
  status = "success",
  error,
  onRetry,
  onRefresh,
  className,
}: EventTypesChartProps) {
  const chartData = (data || []).slice(0, 8).map((event) => ({
    name: event.name.replace(/_/g, " "),
    count: event.count,
    percentage: event.percentage,
  }))

  const renderContent = () => {
    if (status === "error") {
      return (
        <ErrorState
          title="Failed to load events"
          message={error || "We couldn't load the event data."}
          onRetry={onRetry}
        />
      )
    }

    if (!data || data.length === 0) {
      return <NoDataEmptyState onRetry={onRetry} />
    }

    return (
      <ChartContainer config={chartConfig} className="h-[280px] w-full">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 10, bottom: 40 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            width={50}
            tickFormatter={(value) =>
              value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value
            }
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => (
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      {Number(value).toLocaleString()} events
                    </span>
                    <span className="text-muted-foreground">
                      {item.payload.percentage}% of total
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="count"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ChartContainer>
    )
  }

  return (
    <ChartCard
      title="Event Types"
      description="Distribution of tracked behavioral events"
      onRefresh={onRefresh}
      isLoading={status === "loading"}
      className={className}
    >
      {renderContent()}
    </ChartCard>
  )
}
