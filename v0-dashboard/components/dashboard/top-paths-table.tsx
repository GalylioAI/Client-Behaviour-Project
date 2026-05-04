"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ErrorState } from "./error-state"
import { NoDataEmptyState } from "./empty-state"
import type { LoadingState, SimpleRow, SortConfig, SortDirection } from "@/lib/dashboard-types"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface TopPathsTableProps {
  data?: SimpleRow[]
  status?: LoadingState
  error?: string
  onRetry?: () => void
  title?: string
  description?: string
  className?: string
}

export function TopPathsTable({
  data,
  status = "success",
  error,
  onRetry,
  title = "Top Paths",
  description = "Most active routes in the tracked store",
  className,
}: TopPathsTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: "value",
    direction: "desc",
  })

  const handleSort = (column: string) => {
    let direction: SortDirection = "asc"
    if (sortConfig.column === column && sortConfig.direction === "asc") {
      direction = "desc"
    } else if (sortConfig.column === column && sortConfig.direction === "desc") {
      direction = null
    }
    setSortConfig({ column, direction })
  }

  const getSortIcon = (column: string) => {
    if (sortConfig.column !== column || !sortConfig.direction) return <ArrowUpDown className="h-4 w-4" />
    return sortConfig.direction === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const sortedData = useMemo(() => {
    const rows = [...(data || [])]
    if (!sortConfig.direction) return rows
    if (sortConfig.column === "value") {
      rows.sort((a, b) => (sortConfig.direction === "asc" ? a.value - b.value : b.value - a.value))
    }
    return rows
  }, [data, sortConfig])

  if (status === "loading") {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
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
            title="Failed to load table"
            message={error || "We couldn't load this table."}
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
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60%]">Label</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 -ml-3 font-medium"
                  onClick={() => handleSort("value")}
                >
                  Volume
                  {getSortIcon("value")}
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell">Context</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs break-all">{row.label}</TableCell>
                <TableCell className="font-medium tabular-nums">{row.value.toLocaleString()}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{row.secondaryValue || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
