import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react"
import type { KPIData } from "@/lib/dashboard-types"

interface StatCardProps {
  data: KPIData
  className?: string
}

export function StatCard({ data, className }: StatCardProps) {
  const { label, formattedValue, change, icon: Icon, description } = data

  const getTrendIcon = () => {
    if (!change) return null
    switch (change.direction) {
      case "up":
        return <TrendingUp className="h-3.5 w-3.5" />
      case "down":
        return <TrendingDown className="h-3.5 w-3.5" />
      default:
        return <Minus className="h-3.5 w-3.5" />
    }
  }

  const getTrendColor = () => {
    if (!change) return ""
    switch (change.direction) {
      case "up":
        return "text-chart-positive"
      case "down":
        return "text-chart-negative"
      default:
        return "text-muted-foreground"
    }
  }

  return (
    <Card className={cn("py-4", className)}>
      <CardContent className="py-0">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">
                {label}
              </span>
              {description && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">{description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <span className="text-2xl font-semibold tracking-tight">
              {formattedValue}
            </span>
            {change && (
              <div className={cn("flex items-center gap-1 text-xs", getTrendColor())}>
                {getTrendIcon()}
                <span className="font-medium">
                  {change.value > 0 ? "+" : ""}{change.value}%
                </span>
                <span className="text-muted-foreground">{change.label}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="rounded-lg bg-secondary p-2.5">
              <Icon className="h-5 w-5 text-secondary-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Skeleton variant for loading state
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("py-4", className)}>
      <CardContent className="py-0">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-7 w-32 rounded bg-muted animate-pulse" />
            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}
