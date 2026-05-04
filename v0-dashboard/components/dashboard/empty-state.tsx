import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FileQuestion, RefreshCw, Plus } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  title: string
  description: string
  icon?: LucideIcon
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  className?: string
}

export function EmptyState({
  title,
  description,
  icon: Icon = FileQuestion,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-12 text-center",
        className
      )}
    >
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
      {action && (
        <Button onClick={action.onClick} variant="outline" size="sm">
          {action.icon ? (
            <action.icon className="mr-2 h-4 w-4" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {action.label}
        </Button>
      )}
    </div>
  )
}

// Preset empty states for common scenarios
export function NoDataEmptyState({
  onRetry,
  className,
}: {
  onRetry?: () => void
  className?: string
}) {
  return (
    <EmptyState
      title="No data available"
      description="There is no data to display for the selected time period. Try adjusting your filters or check back later."
      action={
        onRetry
          ? {
              label: "Refresh",
              onClick: onRetry,
              icon: RefreshCw,
            }
          : undefined
      }
      className={className}
    />
  )
}
