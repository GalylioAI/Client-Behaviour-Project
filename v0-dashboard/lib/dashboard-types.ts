import type { LucideIcon } from "lucide-react"

// KPI Card Types
export interface KPIData {
  id: string
  label: string
  value: string | number
  formattedValue: string
  change?: {
    value: number
    direction: "up" | "down" | "neutral"
    label: string
  }
  icon?: LucideIcon
  description?: string
}

// Funnel Types
export interface FunnelStage {
  id: string
  name: string
  value: number
  conversionRate?: number
  dropoff?: number
}

export interface FunnelData {
  stages: FunnelStage[]
  totalConversionRate: number
}

// Event Types Chart
export interface EventTypeData {
  name: string
  count: number
  percentage: number
  color?: string
}

// Data Quality Types
export interface ColumnCoverage {
  column: string
  fillRate: number
  sampleValues?: string[]
  dataType: string
}

export interface DataQualityMetrics {
  overallCoverage: number
  totalColumns: number
  columns: ColumnCoverage[]
}

// User Paths Types
export interface UserPath {
  id: string
  path: string[]
  users: number
  percentage: number
  avgDuration?: string
  conversionRate?: number
}

// Behavioral Segments Types
export interface BehavioralSegment {
  id: string
  name: string
  description: string
  userCount: number
  percentage: number
  traits: string[]
  trend?: {
    value: number
    direction: "up" | "down" | "neutral"
  }
}

// ML Propensity Types
export interface PropensityMetrics {
  overallScore: number
  highPropensityUsers: number
  mediumPropensityUsers: number
  lowPropensityUsers: number
  featureImportance: FeatureImportance[]
  note?: string
  modelLabel?: string
  secondaryMetricLabel?: string
  secondaryMetricValue?: number
}

export interface FeatureImportance {
  feature: string
  importance: number
  direction: "positive" | "negative" | "neutral"
}

// Product Insights Types
export interface ProductInsight {
  id: string
  type: "opportunity" | "warning" | "info" | "success"
  title: string
  description: string
  metric?: {
    label: string
    value: string
  }
  action?: {
    label: string
    href?: string
  }
}

export interface SimpleMetric {
  label: string
  value: string
}

export interface SimpleRow {
  id: string
  label: string
  value: number
  secondaryValue?: string
}

// Dashboard State Types
export interface DateRange {
  from: Date
  to: Date
}

export interface DashboardFilters {
  dateRange: DateRange
  storeId?: string
  segment?: string
}

// Loading & Error States
export type LoadingState = "idle" | "loading" | "success" | "error"

export interface SectionState<T> {
  data: T | null
  status: LoadingState
  error?: string
}

// Chart Config Types
export interface ChartDataPoint {
  name: string
  value: number
  [key: string]: string | number
}

// Table Sorting
export type SortDirection = "asc" | "desc" | null

export interface SortConfig {
  column: string
  direction: SortDirection
}
