"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Calendar as CalendarIcon, Download, RefreshCw, Store } from "lucide-react"
import { format } from "date-fns"
import { useState } from "react"
import type { DateRange as DateRangeType } from "@/lib/dashboard-types"

interface Store {
  id: string
  name: string
}

interface DashboardHeaderProps {
  title?: string
  description?: string
  stores?: Store[]
  selectedStore?: string
  onStoreChange?: (storeId: string) => void
  dateRange?: DateRangeType
  onDateRangeChange?: (range: DateRangeType) => void
  onRefresh?: () => void
  onExport?: () => void
  isLoading?: boolean
  className?: string
}

const defaultStores: Store[] = [
  { id: "all", name: "All Stores" },
  { id: "store-1", name: "US Store" },
  { id: "store-2", name: "EU Store" },
  { id: "store-3", name: "APAC Store" },
]

export function DashboardHeader({
  title = "Analytics Dashboard",
  description = "Monitor your ecommerce behavior and performance metrics",
  stores = defaultStores,
  selectedStore = "all",
  onStoreChange,
  dateRange,
  onDateRangeChange,
  onRefresh,
  onExport,
  isLoading = false,
  className,
}: DashboardHeaderProps) {
  const [internalDateRange, setInternalDateRange] = useState<DateRangeType>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  })
  const [internalStore, setInternalStore] = useState(selectedStore)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const activeDateRange = dateRange || internalDateRange
  const activeStore = selectedStore || internalStore

  const handleStoreChange = (value: string) => {
    setInternalStore(value)
    onStoreChange?.(value)
  }

  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      const newRange = { from: range.from, to: range.to }
      setInternalDateRange(newRange)
      onDateRangeChange?.(newRange)
      setIsCalendarOpen(false)
    } else if (range?.from) {
      setInternalDateRange({ ...internalDateRange, from: range.from })
    }
  }

  return (
    <header className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[240px] justify-start text-left font-normal"
              >
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {format(activeDateRange.from, "MMM d, yyyy")} -{" "}
                  {format(activeDateRange.to, "MMM d, yyyy")}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                defaultMonth={activeDateRange.from}
                selected={{
                  from: activeDateRange.from,
                  to: activeDateRange.to,
                }}
                onSelect={handleDateSelect}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          {stores.length > 0 ? (
            <Select value={activeStore} onValueChange={handleStoreChange}>
              <SelectTrigger className="w-[140px]">
                <Store className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {onRefresh && (
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              <span className="sr-only">Refresh data</span>
            </Button>
          )}

          {onExport && (
            <Button variant="outline" size="icon" onClick={onExport}>
              <Download className="h-4 w-4" />
              <span className="sr-only">Export data</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
