"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Database,
  Download,
  ExternalLink,
  Gauge,
  Globe2,
  KeyRound,
  Layers3,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Loader2,
  LogOut,
  MessageCircle,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Workflow,
  X,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { LanguageSwitcher } from "@/components/language-switcher"
import {
  buildDataQuality,
  buildEventMix,
  buildFunnel,
  buildProductInsights,
  buildTopProducts,
  buildTopReferrers,
} from "@/lib/dashboard-adapter"
import type { BehaviorInsights } from "@/lib/insights"
import { useI18n } from "@/lib/i18n"
import type { TenantSiteAccess } from "@/lib/tenant-access"
import type { ProductInsight } from "@/lib/dashboard-types"
import { cn } from "@/lib/utils"

const chartColors = ["#1769E8", "#14B8A6", "#6366F1", "#F59E0B", "#EF4444", "#64748B"]
const SIDEBAR_STORAGE_KEY = "behaviourai:sidebar-open"
const PAGE_HEADER_STORAGE_KEY = "behaviourai:page-header-open"
const AUTOMATION_INTENSITY_STORAGE_KEY = "behaviourai:automation-intensity"
const LOOKBACK_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
]

type DashboardView =
  | "overview"
  | "live"
  | "funnels"
  | "audience"
  | "products"
  | "smart-actions"
  | "smart-intent"
  | "smart-recommendations"
  | "reports"
  | "sites"
  | "pipelines"
  | "settings"

type DashboardSite = Pick<TenantSiteAccess, "site_id" | "tenant_id" | "domain" | "platform" | "status">

type LiveAiInsightBundle = {
  alert: ProductInsight
  recommendations: ProductInsight[]
  mode: "mock" | "llm"
  model: string
  data_as_of: string
  error?: string
}

type TopbarNotification = {
  id: string
  title: string
  description: string
  tone: "healthy" | "warning" | "info"
  href?: string
}

const viewMeta: Record<DashboardView, { title: string; description: string }> = {
  overview: {
    title: "Business Performance Cockpit",
    description: "A compact owner view showing how the store is performing, what changed against the normal daily average, and where to act next.",
  },
  live: {
    title: "Live Events",
    description: "Debug the tracker stream, accepted events, event mix, and freshness for this site.",
  },
  funnels: {
    title: "Conversion Funnels",
    description: "Understand where sessions move from product discovery to cart, checkout, and purchase.",
  },
  audience: {
    title: "Traffic And Audience",
    description: "Review acquisition channels, browser referrers, campaigns, devices, visitor loyalty, and customer account signals.",
  },
  products: {
    title: "Products",
    description: "Rank products by views, clicks, add-to-cart activity, and engagement opportunities.",
  },
  "smart-actions": {
    title: "Smart Actions",
    description: "Score customer intent, prepare product recommendations, and control the automation layer from one place.",
  },
  "smart-intent": {
    title: "Purchase Intent",
    description: "Prioritize visitors and sessions by buying intent, with reasons, signals, and next-best actions.",
  },
  "smart-recommendations": {
    title: "Recommendations",
    description: "Review journey-based product recommendations and prepared email drafts before enabling real sending.",
  },
  reports: {
    title: "Reports And Exports",
    description: "Reusable reporting views for trends, event mix, exports, and operational quality.",
  },
  sites: {
    title: "Sites",
    description: "Manage the current website, installation status, plugin connection, and tenant boundaries.",
  },
  pipelines: {
    title: "Data Pipelines",
    description: "Monitor analysis jobs, infrastructure health, data quality, and model readiness.",
  },
  settings: {
    title: "Settings",
    description: "Review site configuration, allowed origins, platform, timezone, and security controls.",
  },
}

const mainNavigation = [
  { label: "Dashboard", icon: LayoutDashboard, view: "overview" as const },
  { label: "Live Events", icon: Activity, view: "live" as const },
  { label: "Funnels", icon: BarChart3, view: "funnels" as const },
  { label: "Traffic", icon: Users, view: "audience" as const },
  { label: "Products", icon: PackageSearch, view: "products" as const },
  { label: "Reports", icon: LineChartIcon, view: "reports" as const },
  { label: "Sites", icon: Globe2, view: "sites" as const },
]

const smartActionsNavigation = [
  { label: "Smart Actions", icon: Sparkles, view: "smart-actions" as const },
  { label: "Purchase Intent", icon: Gauge, view: "smart-intent" as const },
  { label: "Recommendations", icon: Send, view: "smart-recommendations" as const },
]

const systemNavigation = [
  { label: "API Keys", icon: KeyRound, href: "/keys" },
  { label: "Pipelines", icon: Workflow, view: "pipelines" as const },
  { label: "Settings", icon: Settings, view: "settings" as const },
]

const viewTranslationKeys: Record<DashboardView, string> = {
  overview: "overview",
  live: "live",
  funnels: "funnels",
  audience: "audience",
  products: "products",
  "smart-actions": "smartActions",
  "smart-intent": "intent",
  "smart-recommendations": "recommendations",
  reports: "reports",
  sites: "sites",
  pipelines: "pipelines",
  settings: "settings",
}

const navigationTranslationKeys: Record<string, string> = {
  Dashboard: "nav.overview",
  "Live Events": "nav.live",
  Funnels: "nav.funnels",
  Traffic: "nav.audience",
  Products: "nav.products",
  Reports: "nav.reports",
  Sites: "nav.sites",
  "Smart Actions": "nav.smartActions",
  "Purchase Intent": "nav.intent",
  Recommendations: "nav.recommendations",
  "API Keys": "common.apiKeys",
  Pipelines: "nav.pipelines",
  Settings: "nav.settings",
}

function normalizeView(value: string | null | undefined): DashboardView {
  if (value === "ai") return "smart-actions"
  return value && value in viewMeta ? (value as DashboardView) : "overview"
}

function fmtInt(value: number) {
  return Math.round(value || 0).toLocaleString()
}

function fmtPct(value: number) {
  return `${(value || 0).toFixed(2)}%`
}

function fmtMoney(value: number | null) {
  return value == null ? "Not observed" : `${value.toFixed(2)} TND`
}

function compactUrl(value: string) {
  if (!value) return "No page captured"
  try {
    const url = new URL(value)
    return `${url.hostname.replace(/^www\./, "")}${url.pathname}`
  } catch {
    return value.replace(/^https?:\/\//, "")
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No data yet"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function timeAgo(value: string | null | undefined) {
  if (!value) return "No data"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return formatDate(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.max(0, Math.round(diff / 60000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function cleanLabel(value: string) {
  return value
    .replace(/layer2/gi, "insights")
    .replace(/layer 2/gi, "insights")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function translateProductSecondary(value: string, tr: (text: string) => string) {
  return value.replace(/\bengagement events\b/gi, tr("engagement events"))
}

function translateMetricFragment(value: string, tr: (text: string) => string) {
  return value
    .replace(/\bof sessions\b/gi, tr("of sessions"))
    .replace(/\bpurchases\b/gi, tr("purchases"))
    .replace(/\bsessions\b/gi, tr("sessions"))
}

function csvValue(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function downloadReportCsv(insights: BehaviorInsights) {
  const siteId = insights.operations.site.site_id || "site"
  const rows = [
    ["section", "metric", "value", "extra"],
    ["overview", "raw_events", insights.business_overview.reach.raw_events, ""],
    ["overview", "sessions", insights.business_overview.reach.sessions, ""],
    ["overview", "visitors", insights.business_overview.reach.visitors, ""],
    ["overview", "revenue_tnd", insights.business_overview.sales.revenue_tnd, ""],
    ["overview", "net_revenue_tnd", insights.business_overview.sales.net_revenue_tnd, ""],
    ["overview", "cancelled_orders", insights.business_overview.sales.cancelled_orders, `${insights.business_overview.sales.cancelled_revenue_tnd} TND affected`],
    ["overview", "refunded_orders", insights.business_overview.sales.refunded_orders, ""],
    ["overview", "failed_orders", insights.business_overview.sales.failed_orders, ""],
    ["overview", "average_order_value_tnd", insights.business_overview.sales.average_order_value_tnd, ""],
    ["overview", "purchase_rate_pct", insights.business_overview.conversion.session_to_purchase_rate_pct, ""],
    ["overview", "checkout_conversion_pct", insights.business_overview.conversion.checkout_to_purchase_rate_pct, ""],
    ...insights.commercial_funnel.stages.map((stage) => ["funnel", stage.stage, stage.sessions, `${stage.pct_of_all_sessions}% of sessions`]),
    ...insights.daily_trends.map((day) => ["daily_trend", day.date, day.events, `${day.sessions} sessions, ${day.purchases} purchases`]),
    ...Object.entries(insights.event_mix).map(([eventName, count]) => ["event_mix", eventName, count, "events"]),
    ...insights.acquisition.acquisition_channels.map((channel) => ["acquisition_channel", channel.channel, channel.sessions, `${channel.purchases} purchases, ${channel.revenue} TND`]),
    ...insights.acquisition.top_referrers.map((referrer) => ["referrer", referrer.source, referrer.sessions, referrer.channel]),
    ...insights.acquisition.campaign_sources.map((campaign) => ["campaign", campaign.source, campaign.sessions, `${campaign.medium || "campaign"}, ${campaign.channel}`]),
    ...insights.merchandising.top_products.map((product) => [
      "product",
      product.product_name || product.product_id,
      product.product_views,
      `${product.add_to_cart_events} add_to_cart, ${product.engagement_events} engagement`,
    ]),
  ]
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const href = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = href
  link.download = `${siteId}-behaviour-report.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(href)
}

type PulseTone = "positive" | "negative" | "neutral"
type SalesRange = "daily" | "weekly" | "monthly"

type BusinessPulseMetric = {
  id: string
  label: string
  sublabel: string
  value: string
  deltaPct: number
  baselineLabel: string
  positiveWhenUp: boolean
  series: number[]
  baseline: number
  href: string
}

type SalesBucket = {
  key: string
  label: string
  sort: number
  revenue: number
  sessions: number
  purchases: number
  addToCart: number
}

const salesRanges: Array<{ id: SalesRange; label: string; buckets: number; compareLabel: string }> = [
  { id: "daily", label: "Daily", buckets: 14, compareLabel: "previous 14 days" },
  { id: "weekly", label: "Weekly", buckets: 8, compareLabel: "previous 8 weeks" },
  { id: "monthly", label: "Monthly", buckets: 6, compareLabel: "previous 6 months" },
]

function avg(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0
}

function safeRate(numerator: number, denominator: number) {
  return denominator ? (numerator / denominator) * 100 : 0
}

function pctChange(current: number, baseline: number) {
  if (!baseline) return current ? 100 : 0
  return ((current - baseline) / baseline) * 100
}

function trendTone(deltaPct: number, positiveWhenUp: boolean): PulseTone {
  if (Math.abs(deltaPct) < 0.5) return "neutral"
  const isUp = deltaPct > 0
  return isUp === positiveWhenUp ? "positive" : "negative"
}

function formatSignedPct(value: number) {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

function fmtMoneyAmount(value: number) {
  return `${(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} TND`
}

function latestDayLabel(dateValue: string | undefined) {
  if (!dateValue) return "Latest day"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "Latest day"
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(date)
}

function getDateParts(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short" }).format(date)
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(date)
}

function salesBucketFor(dateValue: string, range: SalesRange) {
  const date = getDateParts(dateValue)
  if (!date) return null

  if (range === "monthly") {
    const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    return {
      key: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${monthLabel(monthStart)} ${String(monthStart.getUTCFullYear()).slice(2)}`,
      sort: monthStart.getTime(),
    }
  }

  if (range === "weekly") {
    const weekStart = new Date(date)
    const weekday = (weekStart.getUTCDay() + 6) % 7
    weekStart.setUTCDate(weekStart.getUTCDate() - weekday)
    weekStart.setUTCHours(0, 0, 0, 0)
    return {
      key: weekStart.toISOString().slice(0, 10),
      label: dayLabel(weekStart),
      sort: weekStart.getTime(),
    }
  }

  return {
    key: date.toISOString().slice(0, 10),
    label: dayLabel(date),
    sort: date.getTime(),
  }
}

function buildSalesBuckets(insights: BehaviorInsights, range: SalesRange) {
  const rows = insights.sales_trends.length ? insights.sales_trends : insights.daily_trends
  const buckets = new Map<string, SalesBucket>()

  for (const row of rows) {
    const bucket = salesBucketFor(row.date, range)
    if (!bucket) continue
    const current = buckets.get(bucket.key) || {
      ...bucket,
      revenue: 0,
      sessions: 0,
      purchases: 0,
      addToCart: 0,
    }
    current.revenue += row.revenue
    current.sessions += row.sessions
    current.purchases += row.purchases
    current.addToCart += row.add_to_cart
    buckets.set(bucket.key, current)
  }

  return Array.from(buckets.values()).sort((a, b) => a.sort - b.sort)
}

function sumSales(rows: SalesBucket[]) {
  return rows.reduce(
    (total, row) => ({
      revenue: total.revenue + row.revenue,
      sessions: total.sessions + row.sessions,
      purchases: total.purchases + row.purchases,
      addToCart: total.addToCart + row.addToCart,
    }),
    { revenue: 0, sessions: 0, purchases: 0, addToCart: 0 }
  )
}

function buildSalesView(insights: BehaviorInsights, range: SalesRange) {
  const rangeConfig = salesRanges.find((item) => item.id === range) || salesRanges[0]
  const buckets = buildSalesBuckets(insights, range)
  const current = buckets.slice(-rangeConfig.buckets)
  const previous = buckets.slice(-(rangeConfig.buckets * 2), -rangeConfig.buckets)
  const currentTotals = sumSales(current)
  const previousTotals = sumSales(previous)
  const currentCr = safeRate(currentTotals.purchases, currentTotals.sessions)
  const previousCr = safeRate(previousTotals.purchases, previousTotals.sessions)
  const currentAov = currentTotals.purchases ? currentTotals.revenue / currentTotals.purchases : 0
  const previousAov = previousTotals.purchases ? previousTotals.revenue / previousTotals.purchases : 0
  const currentAbandonment = safeRate(Math.max(currentTotals.addToCart - currentTotals.purchases, 0), currentTotals.addToCart)
  const previousAbandonment = safeRate(Math.max(previousTotals.addToCart - previousTotals.purchases, 0), previousTotals.addToCart)
  const avgRevenue = avg(current.map((row) => row.revenue))

  return {
    rangeConfig,
    points: current.map((row) => ({ ...row, average: avgRevenue })),
    totals: currentTotals,
    comparison: previousTotals,
    revenueDelta: pctChange(currentTotals.revenue, previousTotals.revenue),
    conversionRate: currentCr,
    conversionDelta: pctChange(currentCr, previousCr),
    averageOrderValue: currentAov,
    averageOrderValueDelta: pctChange(currentAov, previousAov),
    cartAbandonmentRate: currentAbandonment,
    cartAbandonmentDelta: pctChange(currentAbandonment, previousAbandonment),
  }
}

function buildPulseMetrics(insights: BehaviorInsights): BusinessPulseMetric[] {
  const siteId = insights.operations.site.site_id || "tdiscount"
  const trends = insights.daily_trends
  const latest = trends.at(-1)
  const previous = trends.slice(0, -1)
  const baselineRows = previous.length ? previous : trends
  const period = latestDayLabel(latest?.date)
  const baselineLabel = previous.length ? "vs previous daily average" : "vs available daily average"

  const visitors = latest?.visitors ?? insights.business_overview.reach.visitors
  const sessions = latest?.sessions ?? insights.business_overview.reach.sessions
  const carts = latest?.add_to_cart ?? insights.business_overview.conversion.cart_sessions
  const purchases = latest?.purchases ?? insights.business_overview.conversion.purchase_sessions
  const conversionRate = safeRate(purchases, sessions)
  const cartIntentRate = safeRate(carts, sessions)
  const abandonmentRate = safeRate(Math.max(carts - purchases, 0), carts)

  const avgVisitors = avg(baselineRows.map((row) => row.visitors))
  const avgSessions = avg(baselineRows.map((row) => row.sessions))
  const avgCarts = avg(baselineRows.map((row) => row.add_to_cart))
  const avgPurchases = avg(baselineRows.map((row) => row.purchases))
  const avgConversionRate = safeRate(avgPurchases, avgSessions)
  const avgCartIntentRate = safeRate(avgCarts, avgSessions)
  const avgAbandonmentRate = safeRate(Math.max(avgCarts - avgPurchases, 0), avgCarts)

  return [
    {
      id: "visitors",
      label: "Visitors",
      sublabel: period,
      value: fmtInt(visitors),
      deltaPct: pctChange(visitors, avgVisitors),
      baselineLabel,
      positiveWhenUp: true,
      series: trends.map((row) => row.visitors),
      baseline: avgVisitors,
      href: `/app?site_id=${encodeURIComponent(siteId)}&view=audience`,
    },
    {
      id: "sessions",
      label: "Sessions",
      sublabel: period,
      value: fmtInt(sessions),
      deltaPct: pctChange(sessions, avgSessions),
      baselineLabel,
      positiveWhenUp: true,
      series: trends.map((row) => row.sessions),
      baseline: avgSessions,
      href: `/app?site_id=${encodeURIComponent(siteId)}&view=live`,
    },
    {
      id: "purchases",
      label: "Purchases",
      sublabel: period,
      value: fmtInt(purchases),
      deltaPct: pctChange(purchases, avgPurchases),
      baselineLabel,
      positiveWhenUp: true,
      series: trends.map((row) => row.purchases),
      baseline: avgPurchases,
      href: `/app?site_id=${encodeURIComponent(siteId)}&view=funnels`,
    },
    {
      id: "conversion",
      label: "Conversion Rate",
      sublabel: "Purchase sessions",
      value: fmtPct(conversionRate),
      deltaPct: pctChange(conversionRate, avgConversionRate),
      baselineLabel,
      positiveWhenUp: true,
      series: trends.map((row) => safeRate(row.purchases, row.sessions)),
      baseline: avgConversionRate,
      href: `/app?site_id=${encodeURIComponent(siteId)}&view=funnels`,
    },
    {
      id: "cart-intent",
      label: "Cart Intent",
      sublabel: "Add-to-cart rate",
      value: fmtPct(cartIntentRate),
      deltaPct: pctChange(cartIntentRate, avgCartIntentRate),
      baselineLabel,
      positiveWhenUp: true,
      series: trends.map((row) => safeRate(row.add_to_cart, row.sessions)),
      baseline: avgCartIntentRate,
      href: `/app?site_id=${encodeURIComponent(siteId)}&view=products`,
    },
    {
      id: "cart-abandonment",
      label: "Cart Abandonment",
      sublabel: "Carts without purchase",
      value: fmtPct(abandonmentRate),
      deltaPct: pctChange(abandonmentRate, avgAbandonmentRate),
      baselineLabel,
      positiveWhenUp: false,
      series: trends.map((row) => safeRate(Math.max(row.add_to_cart - row.purchases, 0), row.add_to_cart)),
      baseline: avgAbandonmentRate,
      href: `/app?site_id=${encodeURIComponent(siteId)}&view=funnels`,
    },
  ]
}

function StatusDot({
  status = "healthy",
  label,
}: {
  status?: "healthy" | "warning" | "error" | "processing" | "neutral"
  label: string
}) {
  const classes = {
    healthy: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    processing: "bg-blue-500",
    neutral: "bg-slate-400",
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
      <span className={cn("h-2 w-2 rounded-full", classes[status])} />
      {label}
    </span>
  )
}

function Surface({
  title,
  description,
  action,
  className,
  headerClassName,
  actionClassName,
  children,
}: {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
  headerClassName?: string
  actionClassName?: string
  children: ReactNode
}) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]", className)}>
      {(title || description || action) && (
        <div className={cn("flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4", headerClassName)}>
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-slate-950">{title}</h2> : null}
            {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
          </div>
          {action ? <div className={cn("shrink-0", actionClassName)}>{action}</div> : null}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

function siteDisplayName(site: DashboardSite) {
  return site.domain || site.site_id || "Website"
}

function platformDisplayName(platform: string) {
  if (platform === "wordpress") return "WordPress"
  if (platform === "prestashop") return "PrestaShop"
  return platform || "Website"
}

function appHrefForSite(siteId: string, view: DashboardView, lookbackDays?: number) {
  const params = new URLSearchParams()
  if (siteId) params.set("site_id", siteId)
  params.set("view", view)
  if (lookbackDays) params.set("days", String(lookbackDays))
  return `/app?${params.toString()}`
}

function SiteSelector({
  sites,
  currentSite,
  activeView,
  lookbackDays,
}: {
  sites: DashboardSite[]
  currentSite: DashboardSite
  activeView: DashboardView
  lookbackDays?: number
}) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const currentSiteId = currentSite.site_id || sites[0]?.site_id || ""
  const sortedSites = sites.length ? sites : [currentSite]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left transition",
          "hover:border-blue-200 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-100"
        )}
        aria-expanded={isOpen}
      >
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-slate-900">{siteDisplayName(currentSite)}</span>
          <span className="block truncate text-xs text-slate-500">
            {platformDisplayName(currentSite.platform)} · {currentSite.site_id || "no site_id"}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="border-b border-slate-100 px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Workspace websites</div>
            <div className="mt-0.5 text-xs text-slate-500">Switch without creating another account.</div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {sortedSites.map((site) => {
              const isCurrent = site.site_id === currentSiteId
              return (
                <Link
                  key={site.site_id}
                  href={appHrefForSite(site.site_id, activeView, lookbackDays)}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition",
                    isCurrent ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                  )}
                >
                  <div
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-md",
                      isCurrent ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    <Globe2 className="h-4 w-4" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{siteDisplayName(site)}</span>
                    <span className={cn("block truncate text-[11px]", isCurrent ? "text-blue-600/75" : "text-slate-500")}>
                      {platformDisplayName(site.platform)} · {site.site_id}
                    </span>
                  </span>
                  {isCurrent ? (
                    <Badge variant="outline" className="border-blue-100 bg-white text-[10px] text-blue-700">
                      Current
                    </Badge>
                  ) : null}
                </Link>
              )
            })}
          </div>
          <div className="border-t border-slate-100 p-1">
            <Link
              href="/setup"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-700">
                <Plus className="h-4 w-4" />
              </div>
              <span>
                <span className="block text-xs font-semibold">{t("nav.addWebsite")}</span>
                <span className="block text-[11px] font-normal text-slate-500">{t("nav.addWebsiteHelper")}</span>
              </span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Sidebar({
  sites,
  currentSite,
  activeView,
  isCollapsed,
  lookbackDays,
  onToggleSidebar,
}: {
  sites: DashboardSite[]
  currentSite: DashboardSite
  activeView: DashboardView
  isCollapsed: boolean
  lookbackDays?: number
  onToggleSidebar: () => void
}) {
  const { t } = useI18n()
  const siteId = currentSite.site_id || sites[0]?.site_id || ""
  const siteQuery = siteId ? `?site_id=${encodeURIComponent(siteId)}` : ""
  const appHref = (view: DashboardView) => appHrefForSite(siteId, view, lookbackDays)
  const renderNavItem = (item: { label: string; icon: typeof Activity; view?: DashboardView; href?: string }, compact = false) => {
    const isActive = item.view === activeView
    const Icon = item.icon
    const label = t(navigationTranslationKeys[item.label] || item.label)
    const content = (
      <>
        <Icon className="h-4 w-4 shrink-0" />
        <span className={cn("truncate transition-opacity duration-200", isCollapsed && "sr-only")}>{label}</span>
      </>
    )
    const className = cn(
      "flex h-9 w-full items-center rounded-md text-sm font-medium transition-colors",
      isCollapsed ? "justify-center px-0" : "gap-3 px-3",
      compact && !isCollapsed && "h-8 pl-8 text-xs",
      compact && isCollapsed && "h-8",
      isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
    )

    return item.view ? (
      <Link key={item.label} href={appHref(item.view)} className={className} title={label} aria-label={label}>
        {content}
      </Link>
    ) : item.href ? (
      <Link key={item.label} href={`${item.href}${siteQuery}`} className={className} title={label} aria-label={label}>
        {content}
      </Link>
    ) : (
      <button key={item.label} className={className} title={label} aria-label={label}>
        {content}
      </button>
    )
  }

  return (
    <aside className="hidden h-screen min-w-0 overflow-hidden border-r border-slate-200 bg-white transition-all duration-300 ease-out lg:sticky lg:top-0 lg:row-span-2 lg:flex lg:flex-col">
      <div className={cn("flex h-16 items-center border-b border-slate-100 transition-all duration-300", isCollapsed ? "justify-center px-2" : "gap-3 px-5")}>
        <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 text-white shadow-sm">
          <Activity className="h-4 w-4" />
        </div>
        <div className={cn("min-w-0 overflow-hidden whitespace-nowrap transition-all duration-200", isCollapsed ? "w-0 opacity-0" : "w-36 opacity-100")}>
          <div className="text-sm font-semibold text-slate-950">BehaviourAI</div>
          <div className="text-xs text-slate-500">{t("common.behaviourPlatform")}</div>
        </div>
      </div>

      <div className={cn("border-b border-slate-100 py-4 transition-all duration-300", isCollapsed ? "px-3" : "px-4")}>
        {isCollapsed ? (
          <Link
            href={appHref("sites")}
            title={currentSite.domain || currentSite.site_id || "Current website"}
            aria-label="Current website"
            className="mx-auto grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <Globe2 className="h-4 w-4" />
          </Link>
        ) : (
          <SiteSelector sites={sites} currentSite={currentSite} activeView={activeView} lookbackDays={lookbackDays} />
        )}
      </div>

      <nav className={cn("flex-1 space-y-1 py-3 transition-all duration-300", isCollapsed ? "px-3" : "px-3")}>
        {mainNavigation.map((item) => renderNavItem(item))}

        <div className="my-3 space-y-1 border-t border-slate-100 pt-3">
          {smartActionsNavigation.map((item, index) => renderNavItem(item, index > 0))}
        </div>

        {systemNavigation.map((item) => renderNavItem(item))}
      </nav>

      <div className={cn("border-t border-slate-100 transition-all duration-300", isCollapsed ? "p-3" : "p-4")}>
        <button
          type="button"
          onClick={onToggleSidebar}
          className={cn(
            "flex h-9 w-full items-center rounded-md text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950",
            isCollapsed ? "justify-center px-0" : "gap-3 px-3"
          )}
          title={isCollapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          aria-label={isCollapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          <span className={cn("truncate", isCollapsed && "sr-only")}>{isCollapsed ? t("nav.expand") : t("nav.collapse")}</span>
        </button>
      </div>
    </aside>
  )
}

function minutesSince(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
}

function initialsFromEmail(email: string) {
  const clean = email.trim()
  if (!clean) return "AD"
  const [name] = clean.split("@")
  return name
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || clean.slice(0, 2).toUpperCase()
}

function buildTopbarNotifications(insights: BehaviorInsights, siteId: string): TopbarNotification[] {
  const latestEvent = insights.operations.recent_events[0]?.received_at || insights.dataset.date_range_utc.max
  const latestRun = insights.operations.analysis_runs[0]
  const publicKeys = insights.operations.keys.filter((key) => key.key_type === "public_write" && key.status === "active")
  const secretKeys = insights.operations.keys.filter((key) => key.key_type === "server_secret" && key.status === "active")
  const staleMinutes = minutesSince(latestEvent)
  const notifications: TopbarNotification[] = []

  notifications.push({
    id: "freshness",
    title: staleMinutes > 120 ? "Data looks stale" : "Data is receiving",
    description: `Latest accepted event: ${timeAgo(latestEvent)}.`,
    tone: staleMinutes > 120 ? "warning" : "healthy",
    href: appHrefForSite(siteId, "live"),
  })

  if (latestRun) {
    notifications.push({
      id: "analysis",
      title: latestRun.status === "success" ? "Insights refreshed" : "Analysis needs attention",
      description: `${cleanLabel(latestRun.pipeline)} wrote ${fmtInt(latestRun.rows_written)} rows ${timeAgo(latestRun.updated_at)}.`,
      tone: latestRun.status === "success" ? "healthy" : "warning",
      href: appHrefForSite(siteId, "pipelines"),
    })
  }

  notifications.push({
    id: "keys",
    title: publicKeys.length && secretKeys.length ? "Keys are active" : "Key setup incomplete",
    description: `${publicKeys.length} public write key and ${secretKeys.length} private server key active.`,
    tone: publicKeys.length && secretKeys.length ? "healthy" : "warning",
    href: `/keys?site_id=${encodeURIComponent(siteId)}`,
  })

  if (insights.recommendations.prepared_emails > 0) {
    notifications.push({
      id: "emails",
      title: "Recommendation drafts ready",
      description: `${fmtInt(insights.recommendations.prepared_emails)} prepared emails waiting in the outbox.`,
      tone: "info",
      href: `/emails?site_id=${encodeURIComponent(siteId)}`,
    })
  }

  return notifications
}

function topbarSearchActions(siteId: string, activeView: DashboardView, lookbackDays: number, query: string) {
  const entries = [
    { label: "Dashboard", description: "Business performance, revenue, pulse, and summary", keywords: "dashboard overview business revenue sales performance", href: appHrefForSite(siteId, "overview", lookbackDays) },
    { label: "Live Events", description: "Raw event stream and tracker debugging", keywords: "live events raw tracker debug logs receiving", href: appHrefForSite(siteId, "live", lookbackDays) },
    { label: "Funnels", description: "Product, cart, checkout, and purchase drop-offs", keywords: "funnels conversion checkout cart purchase drop off", href: appHrefForSite(siteId, "funnels", lookbackDays) },
    { label: "Traffic And Audience", description: "Channels, referrers, campaigns, devices, and users", keywords: "traffic audience users visitors referrers campaigns channels devices", href: appHrefForSite(siteId, "audience", lookbackDays) },
    { label: "Products", description: "Product engagement, views, clicks, and add-to-cart signals", keywords: "products product views clicks add to cart engagement merchandise", href: appHrefForSite(siteId, "products", lookbackDays) },
    { label: "Purchase Intent", description: "Intent scores, high-value sessions, and reasons", keywords: "intent score scoring high medium low customers sessions ml", href: appHrefForSite(siteId, "smart-intent", lookbackDays) },
    { label: "Recommendations", description: "Recommendation candidates and customer email drafts", keywords: "recommendations email drafts outbox smart actions", href: appHrefForSite(siteId, "smart-recommendations", lookbackDays) },
    { label: "Data Pipelines", description: "Analysis jobs, freshness, and data quality", keywords: "pipelines airflow analysis jobs data quality monitoring", href: appHrefForSite(siteId, "pipelines", lookbackDays) },
    { label: "API Keys", description: "Manage public write and private server keys", keywords: "api keys key token public private write secret", href: `/keys?site_id=${encodeURIComponent(siteId)}` },
    { label: "Setup", description: "Connect another website or inspect installation steps", keywords: "setup connect install plugin wordpress prestashop website", href: "/setup" },
    { label: "Profile", description: "Edit your name, account avatar, and Google profile data", keywords: "profile account user avatar google name email", href: "/profile" },
  ]
  const needle = query.trim().toLowerCase()
  const rawMatches = needle
    ? entries.filter((entry) => `${entry.label} ${entry.description} ${entry.keywords}`.toLowerCase().includes(needle))
    : entries.filter((entry) => entry.href.includes(`view=${activeView}`)).concat(entries).slice(0, 6)
  const seen = new Set<string>()
  return rawMatches.filter((entry) => {
    if (seen.has(entry.href)) return false
    seen.add(entry.href)
    return true
  }).slice(0, 6)
}

function Topbar({
  siteLabel,
  siteId,
  latestEvent,
  activeView,
  lookbackDays,
  notifications,
  userEmail,
  userRole,
  userFullName,
  userAvatarUrl,
  isSidebarOpen,
  onToggleSidebar,
}: {
  siteLabel: string
  siteId: string
  latestEvent: string | null
  activeView: DashboardView
  lookbackDays: number
  notifications: TopbarNotification[]
  userEmail: string
  userRole: string
  userFullName: string
  userAvatarUrl: string
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  const { t } = useI18n()
  const router = useRouter()
  const searchRef = useRef<HTMLFormElement | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false)
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const searchActions = useMemo(
    () => topbarSearchActions(siteId, activeView, lookbackDays, searchQuery),
    [activeView, lookbackDays, searchQuery, siteId]
  )
  const lookbackLabel = LOOKBACK_OPTIONS.find((option) => option.days === lookbackDays)?.label || `Last ${lookbackDays} days`
  const hasWarning = notifications.some((notification) => notification.tone === "warning")
  const accountLabel = userFullName || (userEmail ? userEmail.split("@")[0] : t("common.admin"))

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (searchRef.current && !searchRef.current.contains(target)) {
        setIsSearchOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  function navigate(href: string) {
    setIsSearchOpen(false)
    setSearchQuery("")
    setIsDateMenuOpen(false)
    setIsNotificationMenuOpen(false)
    setIsAccountMenuOpen(false)
    router.push(href)
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!searchQuery.trim()) {
      setIsSearchOpen(true)
      return
    }
    const first = searchActions[0]
    if (first) navigate(first.href)
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="hidden text-slate-500 hover:bg-slate-100 hover:text-slate-950 lg:inline-flex"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? t("nav.collapseSidebar") : t("nav.expandSidebar")}
          title={isSidebarOpen ? t("nav.collapseSidebar") : t("nav.expandSidebar")}
        >
          {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
        <Badge className="border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50" variant="outline">
          <Radio className="h-3 w-3" />
          {t("common.live")}
        </Badge>
        <div className="hidden min-w-0 md:block">
          <div className="truncate text-sm font-semibold text-slate-950">{siteLabel}</div>
          <div className="text-xs text-slate-500">{t("common.lastEvent")} {timeAgo(latestEvent)}</div>
        </div>
      </div>

      <form
        ref={searchRef}
        onSubmit={handleSearchSubmit}
        className="relative hidden min-w-[280px] max-w-[420px] flex-1 lg:block"
      >
        <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsSearchOpen(false)
                setSearchQuery("")
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500"
            placeholder={t("common.searchPlaceholder")}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("")
                setIsSearchOpen(false)
              }}
              className="grid h-5 w-5 place-items-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
            {searchQuery ? "Enter" : "Type"}
          </kbd>
        </div>
        {isSearchOpen ? (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Go to
            </div>
            <div className="p-1">
              {searchActions.length ? searchActions.map((action) => (
                <button
                  key={action.href}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => navigate(action.href)}
                  className="block w-full rounded-md px-3 py-2 text-left transition hover:bg-blue-50"
                >
                  <span className="block text-sm font-semibold text-slate-900">{action.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{action.description}</span>
                </button>
              )) : (
                <div className="px-3 py-4 text-sm text-slate-500">No matching page found.</div>
              )}
            </div>
          </div>
        ) : null}
      </form>

      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" className="hidden border-slate-200 bg-white text-slate-700 md:inline-flex">
          <Link href={`/keys?site_id=${encodeURIComponent(siteId)}`}>
            <KeyRound className="h-4 w-4" />
            {t("common.apiKeys")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="hidden border-slate-200 bg-white text-slate-700 md:inline-flex">
          <Link href="/setup">
            <KeyRound className="h-4 w-4" />
            {t("common.setup")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="hidden border-slate-200 bg-white text-slate-700 md:inline-flex">
          <Link href={`/debug?site_id=${encodeURIComponent(siteId)}`}>
            <Activity className="h-4 w-4" />
            {t("common.debug")}
          </Link>
        </Button>
        <div className="relative hidden md:block">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-200 bg-white text-slate-700"
            onClick={() => setIsDateMenuOpen((current) => !current)}
          >
            <CalendarDays className="h-4 w-4" />
            {lookbackLabel}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isDateMenuOpen && "rotate-180")} />
          </Button>
          {isDateMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl shadow-slate-200/70">
              {LOOKBACK_OPTIONS.map((option) => (
                <button
                  key={option.days}
                  type="button"
                  onClick={() => navigate(appHrefForSite(siteId, activeView, option.days))}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition hover:bg-blue-50",
                    lookbackDays === option.days ? "font-semibold text-blue-700" : "text-slate-700"
                  )}
                >
                  {option.label}
                  {lookbackDays === option.days ? <span className="h-1.5 w-1.5 rounded-full bg-blue-600" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="relative text-slate-500"
            onClick={() => setIsNotificationMenuOpen((current) => !current)}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {hasWarning ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" /> : null}
          </Button>
          {isNotificationMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="text-sm font-semibold text-slate-950">Notifications</div>
                <div className="mt-0.5 text-xs text-slate-500">Live operational status for this website.</div>
              </div>
              <div className="max-h-80 overflow-y-auto p-1">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => notification.href && navigate(notification.href)}
                    className="flex w-full gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        notification.tone === "healthy" && "bg-emerald-500",
                        notification.tone === "warning" && "bg-red-500",
                        notification.tone === "info" && "bg-blue-500"
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{notification.title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">{notification.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setIsAccountMenuOpen((current) => !current)}
            className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 transition hover:border-blue-200 hover:bg-blue-50"
          >
            <div className="grid h-5 w-5 overflow-hidden rounded-full bg-slate-900 text-[10px] font-semibold text-white">
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid h-full w-full place-items-center">{initialsFromEmail(userFullName || userEmail)}</span>
              )}
            </div>
            <span className="max-w-24 truncate text-xs font-medium text-slate-700">{accountLabel}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", isAccountMenuOpen && "rotate-180")} />
          </button>
          {isAccountMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="truncate text-sm font-semibold text-slate-950">{userFullName || userEmail || "Admin"}</div>
                <div className="mt-0.5 truncate text-xs text-slate-500">{userEmail || "No email"}</div>
                <div className="mt-0.5 text-xs capitalize text-slate-400">{userRole || "owner"}</div>
              </div>
              <div className="p-1">
                <button type="button" onClick={() => navigate("/profile")} className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50">Profile</button>
                <button type="button" onClick={() => navigate(appHrefForSite(siteId, "sites", lookbackDays))} className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50">Manage websites</button>
                <button type="button" onClick={() => navigate(appHrefForSite(siteId, "settings", lookbackDays))} className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50">Settings</button>
                <button type="button" onClick={logout} className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50">Sign out</button>
              </div>
            </div>
          ) : null}
        </div>
        <LanguageSwitcher compact />
        <Button type="button" variant="ghost" size="icon-sm" className="text-slate-500" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "blue",
}: {
  label: string
  value: string
  helper: string
  icon: typeof Activity
  tone?: "blue" | "teal" | "indigo" | "amber"
}) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-700",
    teal: "bg-teal-50 text-teal-700",
    indigo: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-700",
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={cn("grid h-8 w-8 place-items-center rounded-md", toneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  )
}

function DeltaBadge({ metric }: { metric: BusinessPulseMetric }) {
  const tone = trendTone(metric.deltaPct, metric.positiveWhenUp)
  const isUp = metric.deltaPct > 0.5
  const isDown = metric.deltaPct < -0.5
  const Icon = isDown ? TrendingDown : TrendingUp
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold tabular-nums",
        tone === "positive" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
        tone === "negative" && "bg-red-50 text-red-700 ring-1 ring-red-100",
        tone === "neutral" && "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", !isUp && !isDown && "rotate-45")} />
      {formatSignedPct(metric.deltaPct)}
    </span>
  )
}

function MiniSparkline({ metric }: { metric: BusinessPulseMetric }) {
  const tone = trendTone(metric.deltaPct, metric.positiveWhenUp)
  const stroke = tone === "positive" ? "#059669" : tone === "negative" ? "#DC2626" : "#64748B"
  const fill = tone === "positive" ? "#D1FAE5" : tone === "negative" ? "#FEE2E2" : "#E2E8F0"
  const values = metric.series.length ? metric.series : [0, metric.baseline, 0]
  const rows = values.map((value, index) => ({
    index,
    value,
    baseline: metric.baseline,
  }))

  return (
    <div className="h-12 min-w-[110px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ left: 2, right: 2, top: 4, bottom: 4 }}>
          <defs>
            <linearGradient id={`pulse-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fill} stopOpacity={0.9} />
              <stop offset="95%" stopColor={fill} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Line type="monotone" dataKey="baseline" stroke={stroke} strokeDasharray="4 4" strokeWidth={1.2} dot={false} />
          <Area type="monotone" dataKey="value" stroke={stroke} fill={`url(#pulse-${metric.id})`} strokeWidth={1.8} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function MovementBadge({
  delta,
  positiveWhenUp = true,
  compact = false,
}: {
  delta: number
  positiveWhenUp?: boolean
  compact?: boolean
}) {
  const tone = trendTone(delta, positiveWhenUp)
  const isDown = delta < -0.5
  const Icon = isDown ? TrendingDown : TrendingUp
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold tabular-nums",
        compact ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm",
        tone === "positive" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
        tone === "negative" && "bg-red-50 text-red-700 ring-1 ring-red-100",
        tone === "neutral" && "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
      )}
    >
      <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", Math.abs(delta) < 0.5 && "rotate-45")} />
      {formatSignedPct(delta)}
    </span>
  )
}

function SalesMetricCard({
  title,
  value,
  delta,
  helper,
  positiveWhenUp = true,
}: {
  title: string
  value: string
  delta: number
  helper: string
  positiveWhenUp?: boolean
}) {
  const tone = trendTone(delta, positiveWhenUp)
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
        tone === "positive" && "border-emerald-100",
        tone === "negative" && "border-red-100",
        tone === "neutral" && "border-slate-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{value}</div>
        </div>
        <MovementBadge delta={delta} positiveWhenUp={positiveWhenUp} compact />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  )
}

function SalesPerformanceSection({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const [range, setRange] = useState<SalesRange>("daily")
  const sales = useMemo(() => buildSalesView(insights, range), [insights, range])
  const hasRevenue = sales.totals.revenue > 0
  const lifecycleLosses = insights.business_overview.sales.cancelled_orders +
    insights.business_overview.sales.refunded_orders +
    insights.business_overview.sales.failed_orders

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tr("Sales / Revenue")}</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{tr("Confirmed Revenue")}</h2>
          </div>
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
            {salesRanges.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  range === item.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-950"
                )}
              >
                {tr(item.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            {fmtMoneyAmount(sales.totals.revenue)}
          </div>
          <MovementBadge delta={sales.revenueDelta} />
        </div>
        <div className="mt-2 text-xs font-medium text-slate-500">
          {hasRevenue ? `${tr("Compared with the")} ${tr(sales.rangeConfig.compareLabel)}` : tr("Waiting for purchase events with order totals")}
        </div>

        <div className="mt-6 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sales.points} margin={{ left: 4, right: 12, top: 16, bottom: 0 }}>
              <defs>
                <linearGradient id="salesRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1769E8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1769E8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
              <YAxis
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748B", fontSize: 12 }}
                tickFormatter={(value) => `${Number(value).toLocaleString()} TND`}
                width={78}
              />
              <Tooltip
                formatter={(value, name) => [
                  name === "revenue" ? fmtMoneyAmount(Number(value)) : fmtMoneyAmount(Number(value)),
                  name === "revenue" ? tr("Revenue") : tr("Average"),
                ]}
                labelFormatter={(label) => `${tr("Period")}: ${label}`}
              />
              <Line type="monotone" dataKey="average" stroke="#94A3B8" strokeDasharray="5 5" strokeWidth={1.4} dot={false} />
              <Area type="monotone" dataKey="revenue" stroke="#1769E8" fill="url(#salesRevenueFill)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <aside className="space-y-4">
        <SalesMetricCard
          title={tr("Conversion Rate")}
          value={fmtPct(sales.conversionRate)}
          delta={sales.conversionDelta}
          helper={tr("Purchase sessions divided by total sessions.")}
        />
        <SalesMetricCard
          title={tr("Average Order Value")}
          value={fmtMoneyAmount(sales.averageOrderValue)}
          delta={sales.averageOrderValueDelta}
          helper={tr("Revenue divided by completed purchases.")}
        />
        <SalesMetricCard
          title={tr("Cart Abandonment")}
          value={fmtPct(sales.cartAbandonmentRate)}
          delta={sales.cartAbandonmentDelta}
          positiveWhenUp={false}
          helper={tr("Users who added to cart but left without buying.")}
        />
        <SalesMetricCard
          title={tr("Order Losses")}
          value={fmtInt(lifecycleLosses)}
          delta={0}
          positiveWhenUp={false}
          helper={`${fmtMoneyAmount(insights.business_overview.sales.cancelled_revenue_tnd)} ${tr("from cancelled, refunded, or failed orders.")}`}
        />
      </aside>
    </section>
  )
}

function BusinessPulseRow({ metric }: { metric: BusinessPulseMetric }) {
  const { tr } = useI18n()
  const tone = trendTone(metric.deltaPct, metric.positiveWhenUp)
  return (
    <Link
      href={metric.href}
      className={cn(
        "group grid min-h-[76px] grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-4 rounded-lg border bg-white px-4 py-3 shadow-[0_1px_1px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
        tone === "positive" && "border-emerald-100 hover:border-emerald-200",
        tone === "negative" && "border-red-100 hover:border-red-200",
        tone === "neutral" && "border-slate-100 hover:border-blue-100"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-950">{tr(metric.label)}</span>
          {tone === "positive" ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : tone === "negative" ? <TrendingDown className="h-4 w-4 text-red-600" /> : null}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">{tr(metric.sublabel)} · {tr(metric.baselineLabel)}</div>
      </div>
      <div className="hidden sm:block">
        <MiniSparkline metric={metric} />
      </div>
      <div className="flex items-center gap-3 justify-self-end">
        <div className="text-right">
          <DeltaBadge metric={metric} />
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{metric.value}</div>
        </div>
        <span className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-slate-500 transition group-hover:border-blue-200 group-hover:text-blue-600">
          <Plus className="h-4 w-4" />
        </span>
      </div>
    </Link>
  )
}

function BusinessPulsePanel({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const metrics = buildPulseMetrics(insights)
  return (
    <Surface
      title={tr("Business Pulse")}
      description={tr("Current store performance compared with the normal daily average. Open any row for the full panel.")}
      action={<Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50">{tr("Stock-style movement")}</Badge>}
      className="bg-gradient-to-br from-white to-blue-50/40"
    >
      <div className="grid gap-3 xl:grid-cols-2">
        {metrics.map((metric) => (
          <BusinessPulseRow key={metric.id} metric={metric} />
        ))}
      </div>
    </Surface>
  )
}

function ExecutiveShortcutGrid({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const siteId = insights.operations.site.site_id || "tdiscount"
  const topProduct = buildTopProducts(insights)[0]
  const topReferrer = buildTopReferrers(insights)[0]
  const dropoff = insights.commercial_funnel.largest_dropoff
  const shortcuts = [
    {
      title: "Biggest Revenue Leak",
      value: `${dropoff.dropoff_pct_points.toFixed(1)} pts`,
      helper: `${tr(cleanLabel(dropoff.from_stage))} ${tr("to")} ${tr(cleanLabel(dropoff.to_stage))}`,
      href: `/app?site_id=${encodeURIComponent(siteId)}&view=funnels`,
      icon: BarChart3,
      tone: "red",
    },
    {
      title: "Product Opportunity",
      value: topProduct ? topProduct.label : tr("Waiting"),
      helper: topProduct ? translateProductSecondary(topProduct.secondaryValue, tr) : tr("No product signal yet"),
      href: `/app?site_id=${encodeURIComponent(siteId)}&view=products`,
      icon: PackageSearch,
      tone: "blue",
    },
    {
      title: "Best Traffic Signal",
      value: topReferrer ? tr(topReferrer.label) : tr("Direct"),
      helper: topReferrer ? translateMetricFragment(topReferrer.secondaryValue, tr) : tr("No referrer signal yet"),
      href: `/app?site_id=${encodeURIComponent(siteId)}&view=audience`,
      icon: Globe2,
      tone: "teal",
    },
  ] as const

  const toneClasses = {
    red: "bg-red-50 text-red-700 border-red-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    teal: "bg-teal-50 text-teal-700 border-teal-100",
  }

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      {shortcuts.map((item) => (
        <Link key={item.title} href={item.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div className={cn("grid h-9 w-9 place-items-center rounded-md border", toneClasses[item.tone])}>
              <item.icon className="h-4 w-4" />
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-slate-500">
              <Plus className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4 text-xs font-medium text-slate-500">{tr(item.title)}</div>
          <div className="mt-2 line-clamp-1 text-xl font-semibold text-slate-950">{item.value}</div>
          <div className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{item.helper}</div>
        </Link>
      ))}
    </section>
  )
}

function FunnelCard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const funnel = buildFunnel(insights)
  const max = Math.max(...funnel.stages.map((stage) => stage.value), 1)
  return (
    <Surface
      title={tr("Conversion Funnel")}
      description={`${tr("Overall conversion")} ${fmtPct(funnel.totalConversionRate)} ${tr("from sessions to purchase.")}`}
      action={<StatusDot status="processing" label={tr("Insight engine")} />}
    >
      <div className="space-y-4">
        {funnel.stages.map((stage, index) => (
          <div key={stage.id} className="grid gap-2">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="font-medium text-slate-700">{tr(stage.name)}</span>
              <span className="font-semibold tabular-nums text-slate-950">{fmtInt(stage.value)}</span>
            </div>
            <div className="h-8 overflow-hidden rounded-md bg-slate-100">
              <div
                className={cn(
                  "flex h-full items-center justify-end rounded-md px-2 text-[11px] font-semibold text-white",
                  index === 0 ? "bg-blue-600" : index === funnel.stages.length - 1 ? "bg-emerald-500" : "bg-blue-500"
                )}
                style={{ width: `${Math.max((stage.value / max) * 100, stage.value ? 8 : 0)}%` }}
              >
                {fmtPct(stage.conversionRate || 0)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Surface>
  )
}

function LiveEventStream({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const events = insights.operations.recent_events
  return (
    <Surface
      title={tr("Real-time Event Stream")}
      description={`${fmtInt(insights.dataset.rows)} ${tr("raw events observed in the current window.")}`}
      action={<StatusDot status={events.length ? "healthy" : "neutral"} label={events.length ? tr("Receiving") : tr("Waiting")} />}
      className="xl:col-span-2"
    >
      <div className="space-y-3">
        {(events.length ? events : []).slice(0, 7).map((event, index) => (
          <div key={`${event.event_name}-${event.received_at}-${index}`} className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50/70 p-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-white text-blue-600 ring-1 ring-slate-200">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-950">{tr(cleanLabel(event.event_name))}</span>
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-500">{event.event_type}</Badge>
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">{compactUrl(event.page_url)}</div>
            </div>
            <div className="hidden text-right text-xs text-slate-500 sm:block">
              <div>{timeAgo(event.received_at)}</div>
              <div>{event.source || event.platform}</div>
            </div>
          </div>
        ))}
        {!events.length ? (
          <div className="rounded-md border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            {tr("No recent events for this site yet.")}
          </div>
        ) : null}
      </div>
    </Surface>
  )
}

function TrafficCard({ insights }: { insights: BehaviorInsights }) {
  const [sourceMode, setSourceMode] = useState<"channels" | "referrers" | "campaigns">("channels")
  const [audienceMode, setAudienceMode] = useState<"all" | "buyers">("all")
  const channelRows = insights.acquisition.acquisition_channels.slice(0, 5).map((channel) => ({
    id: channel.channel,
    label: channel.channel,
    value: channel.sessions,
    secondaryValue: `${fmtPct(channel.share_pct)} of sessions · ${fmtInt(channel.purchases)} purchases · ${fmtMoney(channel.revenue)}`,
  }))
  const buyerChannelRows = insights.acquisition.buyer_acquisition_channels.slice(0, 5).map((channel) => ({
    id: channel.channel,
    label: channel.channel,
    value: channel.purchases,
    secondaryValue: `${fmtInt(channel.sessions)} buyer session${channel.sessions === 1 ? "" : "s"} · ${fmtMoney(channel.revenue)}`,
  }))
  const referrers = buildTopReferrers(insights).slice(0, 5)
  const buyerReferrers = insights.acquisition.buyer_referrers.slice(0, 5).map((referrer) => ({
    id: referrer.referrer_url || "direct",
    label: referrer.source,
    value: referrer.purchases,
    secondaryValue: `${referrer.channel} · ${fmtInt(referrer.sessions)} buyer session${referrer.sessions === 1 ? "" : "s"} · ${fmtMoney(referrer.revenue)}`,
  }))
  const campaignRows = insights.acquisition.campaign_sources.slice(0, 5).map((campaign) => ({
    id: `${campaign.source}-${campaign.medium}-${campaign.campaign || "campaign"}`,
    label: campaign.source,
    value: campaign.sessions,
    secondaryValue: `${campaign.channel} · ${campaign.medium || "campaign"}${campaign.campaign ? ` · ${campaign.campaign}` : ""} · ${fmtPct(campaign.share_pct)} of campaign sessions`,
  }))
  const buyerCampaignRows = insights.acquisition.buyer_campaign_sources.slice(0, 5).map((campaign) => ({
    id: `${campaign.source}-${campaign.medium}-${campaign.campaign || "buyer-campaign"}`,
    label: campaign.source,
    value: campaign.purchases,
    secondaryValue: `${campaign.channel} · ${campaign.medium || "campaign"}${campaign.campaign ? ` · ${campaign.campaign}` : ""} · ${fmtInt(campaign.sessions)} buyer session${campaign.sessions === 1 ? "" : "s"} · ${fmtMoney(campaign.revenue)}`,
  }))
  const rows = sourceMode === "channels"
    ? audienceMode === "buyers" ? buyerChannelRows : channelRows
    : sourceMode === "campaigns"
      ? audienceMode === "buyers" ? buyerCampaignRows : campaignRows
      : audienceMode === "buyers" ? buyerReferrers : referrers
  const chartRows = Array.from(
    rows.reduce((map, row) => {
      const current = map.get(row.label) || { label: row.label, sessions: 0, purchases: 0 }
      if (audienceMode === "buyers") {
        current.purchases += row.value
      } else {
        current.sessions += row.value
      }
      map.set(row.label, current)
      return map
    }, new Map<string, { label: string; sessions: number; purchases: number }>())
  )
    .map(([, row]) => row)
    .sort((a, b) => (audienceMode === "buyers" ? b.purchases - a.purchases : b.sessions - a.sessions))
    .slice(0, 5)
  const chartMetric = audienceMode === "buyers" ? "purchases" : "sessions"
  const modeLabel = sourceMode === "channels" ? "channel" : sourceMode === "campaigns" ? "campaign source" : "referrer"
  const emptyLabel = sourceMode === "campaigns"
    ? audienceMode === "buyers" ? "No buyer campaign sources captured yet." : "No campaign sources captured yet."
    : sourceMode === "channels"
      ? audienceMode === "buyers" ? "No buyer acquisition channels captured yet." : "No acquisition channels captured yet."
      : audienceMode === "buyers" ? "No buyer referral paths captured yet." : "No referral data captured yet."
  const description = sourceMode === "channels"
    ? "Business-friendly acquisition groups using campaign data first, then browser referrers."
    : sourceMode === "campaigns"
      ? "Campaign sources captured from first landing page UTM parameters."
      : "Browser referrers captured from session referrer data."

  return (
    <Surface
      title="Traffic And Referrals"
      description={description}
      headerClassName="flex-col items-stretch gap-3"
      actionClassName="shrink"
      action={
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1">
            {[
              { id: "channels" as const, label: "Channels", icon: Layers3 },
              { id: "referrers" as const, label: "Referrers", icon: Globe2 },
              { id: "campaigns" as const, label: "Campaigns", icon: Send },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSourceMode(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition",
                  sourceMode === item.id ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1">
            {[
              { id: "all" as const, label: "All sessions", icon: Users },
              { id: "buyers" as const, label: "Buyers", icon: CircleDollarSign },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAudienceMode(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition",
                  audienceMode === item.id ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartRows} dataKey={chartMetric} nameKey="label" innerRadius={52} outerRadius={78} paddingAngle={3}>
                {chartRows.map((entry, index) => (
                  <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">{row.label}</div>
                <div className="text-xs text-slate-500">{row.secondaryValue}</div>
              </div>
              <div className="text-right text-sm font-semibold tabular-nums text-slate-950">
                {fmtInt(row.value)}
                <div className="text-[11px] font-medium text-slate-400">{audienceMode === "buyers" ? "buys" : "sessions"}</div>
              </div>
            </div>
          ))}
          {!rows.length ? <p className="text-sm text-slate-500">{emptyLabel}</p> : null}
          {rows.length ? <p className="text-xs leading-5 text-slate-500">Showing top {modeLabel}s for {audienceMode === "buyers" ? "sessions with purchases" : "all sessions"}.</p> : null}
        </div>
      </div>
    </Surface>
  )
}

function AIAlertCard({
  insights,
  aiInsights,
  isAiInsightsLoading = false,
}: {
  insights: BehaviorInsights
  aiInsights?: LiveAiInsightBundle | null
  isAiInsightsLoading?: boolean
}) {
  const { tr } = useI18n()
  const dropoff = insights.commercial_funnel.largest_dropoff
  const productNotes = buildProductInsights(insights)
  const topNote = aiInsights?.alert || productNotes[0]
  const sourceLabel = isAiInsightsLoading ? tr("Generating") : aiInsights?.mode === "llm" ? tr("Live AI") : tr("Rules fallback")
  return (
    <Surface
      title={tr("AI Opportunity Alert")}
      description={aiInsights?.mode === "llm" ? tr("Generated from the latest site snapshot using the configured AI provider.") : tr("Live AI uses the same Copilot provider. Rules stay as fallback if the provider is unavailable.")}
      className="border-red-100 bg-gradient-to-br from-white to-red-50/40"
      action={
        <div className="flex flex-wrap gap-2">
          <Badge className="border-red-100 bg-red-50 text-red-700 hover:bg-red-50" variant="outline">{tr("High impact")}</Badge>
          <Badge className="border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50" variant="outline">
            {isAiInsightsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {sourceLabel}
          </Badge>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{topNote?.title || tr("Largest conversion leak detected")}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {topNote?.description ||
              `${tr("The biggest decline is from")} ${tr(cleanLabel(dropoff.from_stage))} ${tr("to")} ${tr(cleanLabel(dropoff.to_stage))}.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {topNote?.metric ? <Badge variant="outline" className="bg-white">{topNote.metric.label}: {topNote.metric.value}</Badge> : <Badge variant="outline" className="bg-white">{tr("Drop-off")} {dropoff.dropoff_pct_points.toFixed(2)} pts</Badge>}
            <Badge variant="outline" className="bg-white">{aiInsights?.mode === "llm" ? tr("Confidence: AI assisted") : tr("Confidence: rules based")}</Badge>
          </div>
        </div>
      </div>
    </Surface>
  )
}

function ProductEngagementCard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const rows = buildTopProducts(insights).slice(0, 5)
  return (
    <Surface title={tr("Product Engagement")} description={tr("Products ranked by views and observed engagement events.")}>
      <div className="space-y-3">
        {rows.map((row, index) => {
          const content = (
            <>
              <div className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">{index + 1}</div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-slate-900">{row.label}</span>
                  {row.href ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
                </div>
                <div className="text-xs text-slate-500">{translateProductSecondary(row.secondaryValue, tr)}</div>
              </div>
              <div className="text-sm font-semibold tabular-nums text-slate-950">{fmtInt(row.value)}</div>
            </>
          )

          return row.href ? (
            <a
              key={row.id}
              href={row.href}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md p-1.5 transition hover:bg-slate-50"
            >
              {content}
            </a>
          ) : (
            <div key={row.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-1.5">
              {content}
            </div>
          )
        })}
        {!rows.length ? <p className="text-sm text-slate-500">{tr("No product events captured yet.")}</p> : null}
      </div>
    </Surface>
  )
}

function SessionQualityCard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const quality = buildDataQuality(insights)
  const score = Math.round(
    Math.min(
      100,
      (quality.overallCoverage * 0.45) +
        (Math.min(insights.audience.engagement.avg_events_per_session, 20) / 20) * 35 +
        (Math.min(insights.business_overview.reach.repeat_visitor_rate_pct, 40) / 40) * 20
    )
  )
  const data = [
    { name: "Quality", value: score },
    { name: "Gap", value: Math.max(100 - score, 0) },
  ]
  return (
    <Surface title={tr("Session Quality Score")} description={tr("Composite of coverage, engagement depth, and visitor loyalty.")}>
      <div className="grid gap-5 sm:grid-cols-[170px_1fr]">
        <div className="relative h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={52} outerRadius={72} startAngle={210} endAngle={-30}>
                <Cell fill="#22C55E" />
                <Cell fill="#E2E8F0" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-3xl font-semibold text-slate-950">{score}</div>
              <div className="text-xs text-slate-500">{tr("Good")}</div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <MetricLine label={tr("Avg events/session")} value={insights.audience.engagement.avg_events_per_session.toFixed(2)} />
          <MetricLine label={tr("Median duration")} value={`${insights.audience.engagement.median_session_duration_sec.toFixed(0)}s`} />
          <MetricLine label={tr("Repeat visitors")} value={fmtPct(insights.business_overview.reach.repeat_visitor_rate_pct)} />
          <MetricLine label={tr("Data coverage")} value={fmtPct(quality.overallCoverage)} />
        </div>
      </div>
    </Surface>
  )
}

function intentTierLabel(value: string) {
  return value === "converted" ? "Converted" : cleanLabel(value || "cold")
}

function intentTierClass(value: string) {
  if (value === "converted") return "border-blue-100 bg-blue-50 text-blue-700"
  if (value === "high") return "border-emerald-100 bg-emerald-50 text-emerald-700"
  if (value === "medium") return "border-amber-100 bg-amber-50 text-amber-700"
  if (value === "low") return "border-slate-200 bg-slate-50 text-slate-600"
  return "border-slate-200 bg-white text-slate-500"
}

function intentTierColor(value: string) {
  if (value === "converted") return "#1769E8"
  if (value === "high") return "#22C55E"
  if (value === "medium") return "#F59E0B"
  if (value === "low") return "#6366F1"
  return "#CBD5E1"
}

function PurchaseIntentCard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const intent = insights.ml.purchase_intent
  const score = Math.round(intent?.average_score || 0)
  const data = [
    { name: "Intent", value: score },
    { name: "Gap", value: Math.max(100 - score, 0) },
  ]
  const distribution = intent?.distribution?.length
    ? intent.distribution
    : [
        { tier: "high", sessions: 0, visitors: 0, open_sessions: 0, avg_score: 0, share_pct: 0 },
        { tier: "medium", sessions: 0, visitors: 0, open_sessions: 0, avg_score: 0, share_pct: 0 },
        { tier: "low", sessions: 0, visitors: 0, open_sessions: 0, avg_score: 0, share_pct: 0 },
      ]
  const opportunities = intent?.top_opportunities || []

  return (
    <Surface
      title={tr("Purchase Intent Score")}
      description={tr("Rules-based scoring for sessions that look close to buying before ML is trained.")}
      action={<Badge variant="outline" className="bg-white">{intent?.status === "ready" ? tr("Live score") : tr("Collecting")}</Badge>}
    >
      <div className="grid gap-5 lg:grid-cols-[190px_1fr]">
        <div>
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={54} outerRadius={74} startAngle={210} endAngle={-30}>
                  <Cell fill={score >= 70 ? "#22C55E" : score >= 45 ? "#F59E0B" : "#1769E8"} />
                  <Cell fill="#E2E8F0" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-3xl font-semibold text-slate-950">{score}</div>
                <div className="text-xs text-slate-500">{tr("avg score")}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-2">
              <div className="text-base font-semibold text-slate-950">{fmtInt(intent?.open_intent_sessions || 0)}</div>
              <div className="text-[11px] text-slate-500">{tr("open intent")}</div>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-2">
              <div className="text-base font-semibold text-slate-950">{fmtInt(intent?.visitors_scored || 0)}</div>
              <div className="text-[11px] text-slate-500">{tr("visitors")}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            {distribution.map((row) => (
              <div key={row.tier}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline" className={cn("shrink-0", intentTierClass(row.tier))}>{tr(intentTierLabel(row.tier))}</Badge>
                    <span className="truncate text-xs text-slate-500">{fmtInt(row.open_sessions)} {tr("not yet purchased")}</span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-700">{fmtPct(row.share_pct)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(row.share_pct, 100)}%`, backgroundColor: intentTierColor(row.tier) }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">{tr("Best next opportunities")}</div>
              <div className="text-xs text-slate-500">{fmtInt(intent?.sessions_scored || 0)} {tr("sessions scored")}</div>
            </div>
            <div className="space-y-3">
              {opportunities.slice(0, 3).map((row) => (
                <div key={row.session_id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-slate-100 bg-white p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-sm font-semibold text-blue-700">{Math.round(row.score)}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{row.reason || tr("High-intent browsing")}</div>
                    <div className="truncate text-xs text-slate-500">
                      {compactUrl(row.last_page_url)} · {fmtInt(row.product_view_count)} {tr("product views")} · {fmtMoneyAmount(row.cart_value_tnd)}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">{timeAgo(row.session_end)}</div>
                </div>
              ))}
              {!opportunities.length ? <p className="text-sm text-slate-500">{tr("No open high-intent sessions yet. The score will fill as the analysis refresh runs.")}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </Surface>
  )
}

function recommendationTypeLabel(value: string) {
  if (value === "abandoned_cart") return "Cart recovery"
  if (value === "repeated_interest") return "Repeated interest"
  if (value === "clicked_product") return "Clicked product"
  return "Recent view"
}

function automationIntensityLabel(level: number) {
  if (level <= 2) return "Very selective"
  if (level <= 4) return "Selective"
  if (level <= 6) return "Balanced"
  if (level <= 8) return "Expanded reach"
  return "Maximum reach"
}

function automationIntensityThreshold(level: number) {
  const thresholds = [0, 88, 80, 72, 64, 56, 48, 40, 32, 22, 0]
  return thresholds[Math.min(Math.max(level, 1), 10)]
}

function automationIntensityRisk(level: number) {
  if (level <= 3) return { label: "Low", className: "border-emerald-100 bg-emerald-50 text-emerald-700" }
  if (level <= 7) return { label: "Medium", className: "border-amber-100 bg-amber-50 text-amber-700" }
  return { label: "High", className: "border-red-100 bg-red-50 text-red-700" }
}

function automationIntensityRules(level: number) {
  return [
    {
      label: "Abandoned cart recovery",
      included: level >= 1,
      detail: level <= 2 ? "Only strong carts" : "All qualified abandoned carts",
    },
    {
      label: "High purchase intent",
      included: level >= 1,
      detail: `Intent score >= ${automationIntensityThreshold(level)}`,
    },
    {
      label: "Repeated product interest",
      included: level >= 4,
      detail: level >= 4 ? "Multiple views or return interest" : "Excluded at this level",
    },
    {
      label: "General product browsing",
      included: level >= 7,
      detail: level >= 7 ? "Broad product signals included" : "Excluded at this level",
    },
    {
      label: "Low-intent visitors",
      included: level >= 10,
      detail: level >= 10 ? "Included only if contact is allowed" : "Excluded for safety",
    },
  ]
}

function recommendationReachRatioForLevel(level: number) {
  const ratios = [0, 0.08, 0.14, 0.22, 0.32, 0.45, 0.58, 0.7, 0.82, 0.92, 1]
  return ratios[Math.min(Math.max(level, 1), 10)]
}

function RecommendationAutomationCard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const recommendations = insights.recommendations
  const siteId = insights.operations.site.site_id
  const savedIntensity = recommendations.automation?.recommendation_intensity || 5
  const [intensity, setIntensity] = useState(savedIntensity)
  const [savedMessage, setSavedMessage] = useState("")
  const [isSavingIntensity, setIsSavingIntensity] = useState(false)
  const candidates = recommendations.top_candidates.slice(0, 5)
  const emails = recommendations.email_outbox.slice(0, 3)
  const threshold = automationIntensityThreshold(intensity)
  const risk = automationIntensityRisk(intensity)
  const estimateRecipientsForLevel = (level: number) => {
    const levelThreshold = automationIntensityThreshold(level)
    const qualified = recommendations.top_candidates.filter((item) => {
      if (item.recommendation_type === "abandoned_cart") return level >= 1 && item.score >= Math.max(levelThreshold - 12, 0)
      if (item.recommendation_type === "repeated_interest") return level >= 4 && item.score >= levelThreshold
      if (item.recommendation_type === "clicked_product") return level >= 7 && item.score >= levelThreshold
      return level >= 8 && item.score >= levelThreshold
    })

    const reachRatio = recommendations.top_candidates.length
      ? qualified.length / Math.max(recommendations.top_candidates.length, 1)
      : recommendationReachRatioForLevel(level)

    return Math.min(
      recommendations.emailable_customers,
      Math.max(
        recommendations.prepared_emails,
        Math.round(recommendations.emailable_customers * reachRatio)
      )
    )
  }
  const levelEstimates = Array.from({ length: 10 }, (_, index) => {
    const level = index + 1
    return {
      level,
      recipients: estimateRecipientsForLevel(level),
      label: tr(automationIntensityLabel(level)),
    }
  })
  const estimatedRecipients = Math.min(
    recommendations.emailable_customers,
    estimateRecipientsForLevel(intensity)
  )
  const estimatedWeeklyEmails = Math.max(estimatedRecipients, recommendations.prepared_emails)
  const rules = automationIntensityRules(intensity)

  useEffect(() => {
    setIntensity(savedIntensity)
  }, [savedIntensity, siteId])

  useEffect(() => {
    if (recommendations.automation?.updated_at) return
    const saved = window.localStorage.getItem(AUTOMATION_INTENSITY_STORAGE_KEY)
    const parsed = Number(saved)
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 10) {
      setIntensity(parsed)
    }
  }, [recommendations.automation?.updated_at])

  useEffect(() => {
    window.localStorage.setItem(AUTOMATION_INTENSITY_STORAGE_KEY, String(intensity))
    if (!siteId || intensity === savedIntensity) return

    const controller = new AbortController()
    setIsSavingIntensity(true)
    setSavedMessage(tr("Saving automation intensity..."))

    const timer = window.setTimeout(() => {
      fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: siteId,
          recommendation_intensity: intensity,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const result = await response.json().catch(() => ({}))
          if (!response.ok) {
            throw new Error(result.error || tr("Could not save automation intensity."))
          }
          setSavedMessage(tr("Saved. Future recommendation drafts will use this level."))
        })
        .catch((error) => {
          if (error.name === "AbortError") return
          setSavedMessage(error instanceof Error ? error.message : tr("Could not save automation intensity."))
        })
        .finally(() => setIsSavingIntensity(false))
    }, 450)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [intensity, savedIntensity, siteId])

  return (
    <Surface
      title={tr("Recommendation Engine")}
      description={tr("Journey-based product picks and prepared email drafts. Sending remains off until SMTP and consent rules are enabled.")}
      action={
        <Badge variant="outline" className={cn(
          "bg-white",
          recommendations.status === "ready" ? "border-emerald-100 text-emerald-700" : "border-amber-100 text-amber-700"
        )}>
          {recommendations.status === "ready" ? tr("Ready") : tr("Collecting")}
        </Badge>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">{tr("Candidates")}</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">{fmtInt(recommendations.total_candidates)}</div>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">{tr("Visitors")}</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">{fmtInt(recommendations.visitors)}</div>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">{tr("Can email")}</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">{fmtInt(recommendations.emailable_customers)}</div>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">{tr("Avg score")}</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">{recommendations.avg_score.toFixed(1)}</div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">{tr("Automation Intensity")}</div>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                  {tr("Choose how selective the recommendation algorithm should be. Higher levels reach more customers, lower levels focus only on the strongest purchase-intent signals.")}
                </p>
                {savedMessage ? <p className="mt-2 text-xs font-medium text-slate-500">{savedMessage}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                {isSavingIntensity ? (
                  <Badge variant="outline" className="border-slate-200 bg-white text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {tr("Saving")}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">
                  {tr(automationIntensityLabel(intensity))}
                </Badge>
                <Badge variant="outline" className={risk.className}>
                  {tr("Risk")} {tr(risk.label)}
                </Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <div className="text-2xl font-semibold tabular-nums text-slate-950">{intensity}/10</div>
              <Slider
                value={[intensity]}
                min={1}
                max={10}
                step={1}
                onValueChange={(value) => setIntensity(value[0] || 1)}
                aria-label="Automation intensity"
              />
              <div className="text-right text-xs text-slate-500">
                {tr("Threshold")}
                <div className="text-sm font-semibold text-slate-900">{threshold ? `${threshold}+` : tr("Any signal")}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-500">{tr("Estimated recipients")}</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{fmtInt(estimatedRecipients)}</div>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-500">{tr("Estimated emails/week")}</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{fmtInt(estimatedWeeklyEmails)}</div>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-500">{tr("Sending mode")}</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{tr("Draft only")}</div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-slate-700">{tr("Recipients by level")}</div>
                <div className="text-[11px] text-slate-500">{tr("Estimated users who would receive an email")}</div>
              </div>
              <div className="grid grid-cols-5 gap-2 lg:grid-cols-10">
                {levelEstimates.map((item) => (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => setIntensity(item.level)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-center transition",
                      item.level === intensity
                        ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm"
                        : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-white"
                    )}
                    title={`${item.label}: ${fmtInt(item.recipients)} ${tr("Recipients").toLowerCase()}`}
                  >
                    <div className="text-[11px] font-semibold">L{item.level}</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">{fmtInt(item.recipients)}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-800">{tr("Included audiences")}</div>
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.label} className="flex items-start gap-2 rounded-md bg-white/70 p-2">
                  <div className={cn("mt-0.5 h-2.5 w-2.5 rounded-full", rule.included ? "bg-emerald-500" : "bg-slate-300")} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">{tr(rule.label)}</div>
                    <div className="text-[11px] leading-4 text-slate-500">{rule.detail.startsWith("Intent score") ? rule.detail : tr(rule.detail)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">{tr("Top product recommendations")}</div>
            <span className="text-xs text-slate-500">{fmtInt(recommendations.abandoned_cart_candidates)} {tr("cart recovery")}</span>
          </div>
          <div className="space-y-3">
            {candidates.map((item) => {
              const content = (
                <>
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-sm font-semibold text-blue-700">
                    {Math.round(item.score)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-950">{item.product_name || item.product_id}</span>
                      {item.product_url ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {tr(recommendationTypeLabel(item.recommendation_type))} · {item.reason}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{fmtInt(item.views)} {tr("views")}</div>
                    <div>{fmtInt(item.add_to_cart_events)} {tr("carts")}</div>
                  </div>
                </>
              )

              return item.product_url ? (
                <a
                  key={item.recommendation_id}
                  href={item.product_url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-slate-100 bg-white p-3 transition hover:bg-slate-50"
                >
                  {content}
                </a>
              ) : (
                <div key={item.recommendation_id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-slate-100 bg-white p-3">
                  {content}
                </div>
              )
            })}
            {!candidates.length ? <p className="text-sm text-slate-500">{tr("No recommendation candidates yet. Refresh the insights after more product journeys arrive.")}</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-blue-950">{tr("Prepared emails")}</div>
              <div className="text-xs text-blue-800">{fmtInt(recommendations.prepared_emails)} {tr("drafts in outbox")}</div>
            </div>
            <Send className="h-5 w-5 text-blue-700" />
          </div>
          <div className="mt-4 space-y-3">
            {emails.map((email) => (
              <div key={email.email_id} className="rounded-md border border-blue-100 bg-white/80 p-3">
                <div className="truncate text-sm font-medium text-slate-950">{email.to_email}</div>
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{email.preview_text}</div>
                <div className="mt-2 text-[11px] text-slate-400">{fmtInt(email.product_count)} {tr("products")} · {timeAgo(email.updated_at)}</div>
              </div>
            ))}
            {!emails.length ? <p className="text-sm leading-6 text-blue-900">{tr("No email drafts yet. We only prepare drafts when a customer email exists in the tracked journey.")}</p> : null}
          </div>
          <Button asChild variant="outline" className="mt-4 w-full border-blue-200 bg-white text-blue-700 hover:bg-blue-50">
            <Link href={`/emails?site_id=${encodeURIComponent(siteId)}`}>
              {tr("Review Outbox")}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Surface>
  )
}

function SmartActionMetric({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: string
  helper: string
  icon: typeof Activity
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div>
    </div>
  )
}

function SmartActionFeatureCard({
  title,
  description,
  href,
  icon: Icon,
  status,
  metrics,
}: {
  title: string
  description: string
  href: string
  icon: typeof Activity
  status: string
  metrics: Array<{ label: string; value: string }>
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:border-blue-200 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
        <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700">
          {status}
        </Badge>
      </div>
      <div className="mt-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          {title}
          <ExternalLink className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-blue-600" />
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[11px] font-medium text-slate-500">{metric.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">{metric.value}</div>
          </div>
        ))}
      </div>
    </Link>
  )
}

function SmartActionsPreviewCard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const siteId = insights.operations.site.site_id || "tdiscount"
  const intent = insights.ml.purchase_intent
  const recommendations = insights.recommendations
  const readyActions = (intent?.open_intent_sessions || 0) + recommendations.prepared_emails

  return (
    <Surface
      title={tr("Smart Actions")}
      description={tr("Your scoring, recommendations, and prepared outreach now live in one workspace.")}
      action={
        <Button asChild variant="outline" className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50">
          <Link href={appHrefForSite(siteId, "smart-actions")}>
            {tr("Open Hub")}
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        <MetricLine label={tr("Ready actions")} value={fmtInt(readyActions)} />
        <MetricLine label={tr("Avg intent score")} value={(intent?.average_score || 0).toFixed(1)} />
        <MetricLine label={tr("Recommendation candidates")} value={fmtInt(recommendations.total_candidates)} />
        <MetricLine label={tr("Email drafts")} value={fmtInt(recommendations.prepared_emails)} />
      </div>
    </Surface>
  )
}

function SmartActionGuardrailsCard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const siteId = insights.operations.site.site_id || "tdiscount"
  const rows = [
    {
      icon: Send,
      label: "Sending mode",
      value: "Draft only",
      detail: "Emails are prepared in the outbox but not sent automatically.",
      status: "Safe",
    },
    {
      icon: ShieldCheck,
      label: "Consent rules",
      value: "Required before live send",
      detail: "Opt-in, unsubscribe, and suppression logic should be connected before real outreach.",
      status: "Next",
    },
    {
      icon: Bell,
      label: "Action limits",
      value: "Planned",
      detail: "Cooldowns, max messages per customer, and quiet hours will prevent spammy behaviour.",
      status: "Planned",
    },
    {
      icon: Settings,
      label: "Provider setup",
      value: "Not connected",
      detail: "SMTP, WhatsApp, or another provider can be attached once the action rules are stable.",
      status: "Pending",
    },
  ]

  return (
    <Surface
      title={tr("Configuration And Guardrails")}
      description={tr("The action layer is intentionally conservative: it can prepare work today, while live sending stays protected behind business rules.")}
      action={
        <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
          <Link href={`/emails?site_id=${encodeURIComponent(siteId)}`}>
            {tr("Review Outbox")}
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-blue-700 ring-1 ring-slate-200">
                  <row.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950">{tr(row.label)}</div>
                  <div className="mt-1 text-xs font-medium text-slate-600">{tr(row.value)}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{tr(row.detail)}</div>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 border-slate-200 bg-white text-slate-600">
                {tr(row.status)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
        Next real configuration step for {siteId}: store action rules in the backend, then let each automation move from draft mode to manual approval and finally to live sending.
      </div>
    </Surface>
  )
}

function SmartActionsDashboard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const siteId = insights.operations.site.site_id || "tdiscount"
  const intent = insights.ml.purchase_intent
  const recommendations = insights.recommendations
  const readyActions = (intent?.open_intent_sessions || 0) + recommendations.prepared_emails
  const latestDraft = recommendations.email_outbox[0]
  const latestCandidate = recommendations.top_candidates[0]
  const intentStatus = intent?.status === "ready" ? tr("Ready") : tr("Collecting")
  const recommendationStatus = recommendations.status === "ready" ? tr("Ready") : tr("Collecting")

  return (
    <>
      <Surface
        title={tr("What Smart Actions Does")}
        description={tr("Smart Actions turns tracked behaviour into practical follow-up opportunities for the business.")}
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="text-sm leading-6 text-slate-600">
            {tr("It connects three jobs that should work together: scoring visitors by purchase intent, selecting products that match their journey, and preparing outreach drafts for customers who can be contacted. The goal is to help the store recover abandoned carts, follow up on repeated product interest, and focus the team on visitors most likely to buy.")}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {[
              { label: tr("Score"), value: tr("Find high-intent visitors"), icon: Gauge },
              { label: tr("Recommend"), value: tr("Pick relevant products"), icon: PackageSearch },
              { label: tr("Act"), value: tr("Prepare email actions"), icon: Send },
              { label: tr("Measure"), value: tr("Track results safely"), icon: LineChartIcon },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white text-blue-700 ring-1 ring-slate-200">
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-950">{item.label}</div>
                  <div className="truncate text-xs text-slate-500">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {tr("Current mode is draft-only: the system prepares recommendations and email drafts, but real sending stays off until consent rules, unsubscribe handling, and a sending provider are connected.")}
        </div>
      </Surface>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <SmartActionMetric
          label={tr("Ready actions")}
          value={fmtInt(readyActions)}
          helper={tr("Open intent sessions plus prepared recommendation drafts")}
          icon={Sparkles}
        />
        <SmartActionMetric
          label={tr("Average intent score")}
          value={(intent?.average_score || 0).toFixed(1)}
          helper={`${fmtInt(intent?.sessions_scored || 0)} ${tr("sessions scored")}`}
          icon={Gauge}
        />
        <SmartActionMetric
          label={tr("Recommendation candidates")}
          value={fmtInt(recommendations.total_candidates)}
          helper={`${fmtInt(recommendations.visitors)} ${tr("visitors with product signals")}`}
          icon={PackageSearch}
        />
        <SmartActionMetric
          label={tr("Email drafts")}
          value={fmtInt(recommendations.prepared_emails)}
          helper={`${fmtInt(recommendations.emailable_customers)} ${tr("customers can receive outreach")}`}
          icon={Send}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <SmartActionFeatureCard
          title={tr("Purchase Intent Scoring")}
          description={tr("Rank sessions and visitors by buying probability, then inspect the signals behind every score.")}
          href={appHrefForSite(siteId, "smart-intent")}
          icon={Gauge}
          status={intentStatus}
          metrics={[
            { label: tr("High intent"), value: fmtInt(intent?.high_intent_sessions || 0) },
            { label: tr("Open opportunities"), value: fmtInt(intent?.open_intent_sessions || 0) },
            { label: tr("Converted"), value: fmtInt(intent?.converted_sessions || 0) },
            { label: tr("Visitors scored"), value: fmtInt(intent?.visitors_scored || 0) },
          ]}
        />
        <SmartActionFeatureCard
          title={tr("Product Recommendations")}
          description={tr("Prepare product picks and recovery emails from cart, repeat-interest, and browsing journeys.")}
          href={appHrefForSite(siteId, "smart-recommendations")}
          icon={Send}
          status={recommendationStatus}
          metrics={[
            { label: tr("Candidates"), value: fmtInt(recommendations.total_candidates) },
            { label: tr("Cart recovery"), value: fmtInt(recommendations.abandoned_cart_candidates) },
            { label: tr("Email drafts"), value: fmtInt(recommendations.prepared_emails) },
            { label: tr("Avg score"), value: recommendations.avg_score.toFixed(1) },
          ]}
        />
      </section>

      <SmartActionGuardrailsCard insights={insights} />

      <Surface title={tr("Action Queue")} description={tr("The most important next actions across scoring and recommendations.")}>
        <div className="grid gap-5 xl:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">{tr("Highest intent sessions")}</div>
              <Button asChild size="sm" variant="outline" className="border-slate-200 bg-white text-slate-700">
                <Link href={appHrefForSite(siteId, "smart-intent")}>{tr("Inspect")}</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {(intent?.top_opportunities || []).slice(0, 4).map((item) => (
                <div key={item.session_id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-sm font-semibold text-blue-700">
                    {Math.round(item.score)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-950">{item.customer_email || item.visitor_id || tr("Anonymous visitor")}</div>
                    <div className="truncate text-xs text-slate-500">{item.reason}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500">{cleanLabel(item.tier)}</div>
                </div>
              ))}
              {!intent?.top_opportunities.length ? <p className="text-sm text-slate-500">{tr("No open purchase-intent opportunities yet.")}</p> : null}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">{tr("Recommendation outreach")}</div>
              <Button asChild size="sm" variant="outline" className="border-slate-200 bg-white text-slate-700">
                <Link href={`/emails?site_id=${encodeURIComponent(siteId)}`}>{tr("Outbox")}</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {recommendations.email_outbox.slice(0, 4).map((email) => (
                <div key={email.email_id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-950">{email.to_email}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{email.preview_text}</div>
                    </div>
                    <Badge variant="outline" className="border-blue-100 bg-white text-blue-700">
                      {fmtInt(email.product_count)}
                    </Badge>
                  </div>
                </div>
              ))}
              {!recommendations.email_outbox.length ? <p className="text-sm text-slate-500">{tr("No recommendation drafts yet.")}</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <MetricLine label={tr("Latest recommendation")} value={latestCandidate ? timeAgo(latestCandidate.last_signal_at) : tr("No data")} />
          <MetricLine label={tr("Latest draft")} value={latestDraft ? timeAgo(latestDraft.updated_at) : tr("No data")} />
          <MetricLine label={tr("Sending mode")} value={tr("Draft only")} />
        </div>
      </Surface>
    </>
  )
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-slate-950">{value}</span>
    </div>
  )
}

function TrendsCard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const trendData = insights.daily_trends.map((row) => ({
    date: row.date.slice(5),
    sessions: row.sessions,
    carts: row.add_to_cart,
    purchases: row.purchases,
  }))
  return (
    <Surface title={tr("Daily Behaviour Trend")} description={tr("Sessions, carts, and purchases over the current analysis window.")} className="xl:col-span-2">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ left: 4, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} width={42} />
            <Tooltip />
            <Line type="linear" dataKey="sessions" stroke="#1769E8" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
            <Line type="linear" dataKey="carts" stroke="#14B8A6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
            <Line type="linear" dataKey="purchases" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  )
}

function EventMixCard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const rows = buildEventMix(insights).slice(0, 8).map((row) => ({
    ...row,
    translatedName: tr(row.name),
  }))
  return (
    <Surface title={tr("Event Mix")} description={tr("Most frequent event names from the analysis engine.")}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid stroke="#E2E8F0" horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis dataKey="translatedName" type="category" tickLine={false} axisLine={false} width={120} tick={{ fill: "#64748B", fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#1769E8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  )
}

function ModelReadinessCard({ insights }: { insights: BehaviorInsights }) {
  const rows = [
    { label: "Behaviour features", value: insights.dataset.rows ? "Ready" : "Waiting", status: insights.dataset.rows ? "healthy" : "neutral" },
    { label: "Session clustering", value: insights.ml.session_clustering?.segments?.length ? "Ready" : "Collecting", status: insights.ml.session_clustering?.segments?.length ? "healthy" : "processing" },
    { label: "Purchase propensity", value: insights.ml.purchase_propensity?.status === "ok" ? "Ready" : "Planned", status: insights.ml.purchase_propensity?.status === "ok" ? "healthy" : "warning" },
    { label: "AI recommendations", value: insights.saas_product_notes.length ? "Available" : "Rules only", status: insights.saas_product_notes.length ? "healthy" : "processing" },
  ] as const
  return (
    <Surface title="Model Readiness" description="A practical bridge between current analytics and future ML/AI training.">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <StatusDot status={row.status} label={row.label} />
            <span className="text-sm font-semibold text-slate-900">{row.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-md border border-indigo-100 bg-indigo-50 p-3 text-sm leading-6 text-indigo-900">
        Use `site_id` as the training boundary. Extract features per site, train later, and compare model quality before showing AI decisions to customers.
      </div>
    </Surface>
  )
}

function PipelineHealthCard({ insights }: { insights: BehaviorInsights }) {
  const runs = insights.operations.analysis_runs.slice(0, 5)
  return (
    <Surface title="Pipeline Health" description="Latest analysis jobs written by the insights workflow.">
      <div className="space-y-3">
        {runs.map((run) => (
          <div key={run.run_id} className="flex items-center justify-between gap-4 rounded-md border border-slate-100 bg-slate-50/70 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{cleanLabel(run.pipeline)}</div>
              <div className="text-xs text-slate-500">{fmtInt(run.rows_written)} rows written · {timeAgo(run.updated_at)}</div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "bg-white",
                run.status === "success" ? "border-emerald-100 text-emerald-700" : "border-amber-100 text-amber-700"
              )}
            >
              {run.status || "unknown"}
            </Badge>
          </div>
        ))}
        {!runs.length ? <p className="text-sm text-slate-500">No pipeline run history found.</p> : null}
      </div>
    </Surface>
  )
}

function RightPanel({
  insights,
  aiInsights,
  isAiInsightsLoading = false,
}: {
  insights: BehaviorInsights
  aiInsights?: LiveAiInsightBundle | null
  isAiInsightsLoading?: boolean
}) {
  const site = insights.operations.site
  const keys = insights.operations.keys
  const latestRun = insights.operations.analysis_runs[0]
  const publicKeys = keys.filter((key) => key.key_type === "public_write")
  const secretKeys = keys.filter((key) => key.key_type === "server_secret")
  const aiRecommendations = aiInsights?.recommendations?.length ? aiInsights.recommendations : buildProductInsights(insights).slice(0, 3)
  const aiStatusLabel = isAiInsightsLoading ? "Generating" : aiInsights?.mode === "llm" ? "Live AI" : "Rules fallback"
  return (
    <aside className="hidden border-l border-slate-200 bg-slate-50/80 xl:col-start-3 xl:row-start-2 xl:block">
      <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-4">
        <div className="space-y-4">
          <Surface title="Tenant / Site Status" className="shadow-none">
            <div className="space-y-3">
              <MetricLine label="Site ID" value={site.site_id || "tdiscount"} />
              <MetricLine label="Tenant" value={site.tenant_id || "demo"} />
              <MetricLine label="Platform" value={site.platform || "wordpress"} />
              <MetricLine label="Status" value={site.status || "active"} />
              <MetricLine label="Plan" value={site.plan || "internal"} />
            </div>
          </Surface>

          <Surface
            title="API Key Status"
            className="shadow-none"
            action={
              <Button asChild variant="outline" size="sm" className="border-slate-200 bg-white text-slate-700">
                <Link href={`/keys?site_id=${encodeURIComponent(site.site_id || "tdiscount")}`}>
                  Manage
                </Link>
              </Button>
            }
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StatusDot status={publicKeys.length ? "healthy" : "warning"} label="Public write keys" />
                <span className="text-sm font-semibold">{publicKeys.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <StatusDot status={secretKeys.length ? "healthy" : "warning"} label="Server secrets" />
                <span className="text-sm font-semibold">{secretKeys.length}</span>
              </div>
              {keys.slice(0, 3).map((key) => (
                <div key={`${key.key_type}-${key.key_prefix}`} className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">{key.key_prefix}</span> · {cleanLabel(key.key_type)} · {key.status}
                </div>
              ))}
            </div>
          </Surface>

          <Surface title="Infrastructure Health" className="shadow-none">
            <div className="space-y-3">
              <HealthRow icon={Database} label="ClickHouse" value="Healthy" />
              <HealthRow icon={Server} label="Kafka" value="Healthy" />
              <HealthRow icon={Workflow} label="Airflow" value={latestRun ? "Latest run found" : "Waiting"} />
              <HealthRow icon={ShieldCheck} label="Bridge auth" value="Registry enabled" />
            </div>
          </Surface>

          <Surface title="Latest Airflow Run" className="shadow-none">
            {latestRun ? (
              <div className="space-y-3">
                <MetricLine label="Pipeline" value={cleanLabel(latestRun.pipeline)} />
                <MetricLine label="Status" value={latestRun.status} />
                <MetricLine label="Rows" value={fmtInt(latestRun.rows_written)} />
                <MetricLine label="Updated" value={timeAgo(latestRun.updated_at)} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">No latest run available.</p>
            )}
          </Surface>

          <Surface title="Exports" className="shadow-none">
            <Button variant="outline" className="w-full border-slate-200 bg-white text-slate-700">
              <Download className="h-4 w-4" />
              Export Dashboard
            </Button>
          </Surface>

          <Surface
            title="AI Recommendations"
            className="shadow-none"
            action={<StatusDot status={aiInsights?.mode === "llm" ? "healthy" : isAiInsightsLoading ? "processing" : "neutral"} label={aiStatusLabel} />}
          >
            <div className="space-y-3">
              {isAiInsightsLoading && !aiInsights ? (
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating current suggestions...
                  </div>
                  The same AI provider used by Copilot is reading the latest site snapshot.
                </div>
              ) : null}
              {aiRecommendations.map((item) => (
                <div key={item.id} className="rounded-md border border-indigo-100 bg-indigo-50 p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 text-indigo-600" />
                    <div>
                      <div className="text-sm font-semibold text-indigo-950">{item.title}</div>
                      <div className="mt-1 line-clamp-3 text-xs leading-5 text-indigo-800">{item.description}</div>
                      {item.metric ? <div className="mt-2 text-[11px] font-semibold text-indigo-700">{item.metric.label}: {item.metric.value}</div> : null}
                    </div>
                  </div>
                </div>
              ))}
              {aiInsights?.error ? <p className="text-xs leading-5 text-slate-500">AI provider fallback: {aiInsights.error}.</p> : null}
            </div>
          </Surface>
        </div>
      </div>
    </aside>
  )
}

function HealthRow({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </div>
      <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700">
        {value}
      </Badge>
    </div>
  )
}

function CommandBar() {
  const { tr } = useI18n()
  const [question, setQuestion] = useState("")
  const prompts = ["Why did conversion drop?", "Top products this week", "Compare mobile vs desktop"]

  function askCopilot(value: string) {
    const clean = value.trim()
    if (!clean) return
    window.dispatchEvent(new CustomEvent("behaviourai:copilot:ask", { detail: { question: clean } }))
    setQuestion("")
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    askCopilot(question)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <form onSubmit={submit} className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              askCopilot(question)
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          placeholder={tr("Ask AI about your data...")}
        />
        <Button type="submit" size="icon-sm" disabled={!question.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2 px-1">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => askCopilot(prompt)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            {tr(prompt)}
          </button>
        ))}
      </div>
    </div>
  )
}

function DeviceMixCard({ insights }: { insights: BehaviorInsights }) {
  const rows = insights.audience.device_mix.slice(0, 6)
  const max = Math.max(...rows.map((row) => row.sessions), 1)
  return (
    <Surface title="Device Mix" description="Sessions by detected device type.">
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.device_type} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="font-medium text-slate-700">{cleanLabel(row.device_type || "unknown")}</span>
              <span className="font-semibold tabular-nums text-slate-950">{fmtInt(row.sessions)} · {fmtPct(row.share_pct)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max((row.sessions / max) * 100, row.sessions ? 8 : 0)}%` }} />
            </div>
          </div>
        ))}
        {!rows.length ? <p className="text-sm text-slate-500">No device data captured yet.</p> : null}
      </div>
    </Surface>
  )
}

function CustomerSignalsCard({ insights }: { insights: BehaviorInsights }) {
  return (
    <Surface title="Customer Signals" description="Account, search, and newsletter behaviour observed for this site.">
      <div className="space-y-3">
        <MetricLine label="New sessions" value={fmtInt(insights.business_overview.customer_growth.new_sessions)} />
        <MetricLine label="Returning sessions" value={fmtInt(insights.business_overview.customer_growth.returning_sessions)} />
        <MetricLine label="Search adoption" value={fmtPct(insights.business_overview.customer_growth.search_adoption_pct)} />
        <MetricLine label="Registrations" value={fmtInt(insights.customer.accounts.registration_events)} />
        <MetricLine label="Newsletter opt-in" value={fmtPct(insights.customer.newsletter.opt_in_rate_pct)} />
      </div>
    </Surface>
  )
}

function DataCoverageCard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const quality = buildDataQuality(insights)
  const rows = quality.columns.slice(0, 8)
  return (
    <Surface title={tr("Data Coverage")} description={tr("Completeness of required fields on received events. Behaviour frequencies are shown separately.")}>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.column} className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">{tr(cleanLabel(row.column))}</span>
              <span className="font-semibold text-slate-950">{fmtPct(row.fillRate)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full", row.fillRate >= 80 ? "bg-emerald-500" : row.fillRate >= 45 ? "bg-amber-500" : "bg-red-500")}
                style={{ width: `${Math.max(Math.min(row.fillRate, 100), row.fillRate ? 6 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Surface>
  )
}

function EventCaptureHealthCard({ insights }: { insights: BehaviorInsights }) {
  const { tr } = useI18n()
  const eventRows = [
    {
      key: "add_to_cart",
      label: "Add To Cart",
      helper: "Cart action events",
      tone: "blue",
    },
    {
      key: "checkout_start",
      label: "Checkout Started",
      helper: "Checkout entry events",
      tone: "indigo",
    },
    {
      key: "purchase_completed",
      label: "Purchase Completed",
      helper: "Backend purchase and order events",
      tone: "emerald",
    },
  ] as const
  const values = insights.column_utilization.top_15_filled

  const toneClasses = {
    blue: "bg-blue-500",
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
  }

  return (
    <Surface
      title={tr("Event Capture Health")}
      description={tr("How often key commerce actions appear in the event stream. This is behaviour frequency, not field completeness.")}
    >
      <div className="space-y-4">
        {eventRows.map((row) => {
          const rate = Number(((values[row.key] || 0) * 100).toFixed(1))
          return (
            <div key={row.key} className="space-y-2">
              <div className="flex items-start justify-between gap-4 text-xs">
                <div>
                  <div className="font-medium text-slate-700">{tr(row.label)}</div>
                  <div className="mt-0.5 text-slate-500">{tr(row.helper)}</div>
                </div>
                <span className="font-semibold tabular-nums text-slate-950">{fmtPct(rate)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className={cn("h-full rounded-full", toneClasses[row.tone])}
                  style={{ width: `${Math.max(Math.min(rate, 100), rate ? 6 : 0)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
        {tr("Low percentages can be normal on busy stores, but sudden drops should be checked in Live Events.")}
      </div>
    </Surface>
  )
}

function SiteControlsCard({ insights }: { insights: BehaviorInsights }) {
  const site = insights.operations.site
  const siteId = site.site_id || "tdiscount"
  return (
    <Surface title="Website Workspace" description="Operational controls for the selected website.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link href={`/connect?site_id=${encodeURIComponent(siteId)}`}>
            <PlugZapIcon />
            Connect
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
          <Link href={`/debug?site_id=${encodeURIComponent(siteId)}`}>
            <Activity className="h-4 w-4" />
            Debug
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
          <Link href={`/keys?site_id=${encodeURIComponent(siteId)}`}>
            <KeyRound className="h-4 w-4" />
            Keys
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
          <Link href={`/downloads?site_id=${encodeURIComponent(siteId)}`}>
            <Download className="h-4 w-4" />
            Plugins
          </Link>
        </Button>
      </div>
    </Surface>
  )
}

function PlugZapIcon() {
  return <Radio className="h-4 w-4" />
}

function SiteConfigurationCard({ insights }: { insights: BehaviorInsights }) {
  const site = insights.operations.site
  return (
    <Surface title="Site Configuration" description="Current tenant and tracker configuration loaded from ClickHouse.">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <MetricLine label="Site ID" value={site.site_id || "Not set"} />
          <MetricLine label="Domain" value={site.domain || "Not set"} />
          <MetricLine label="Tenant" value={site.tenant_id || "Not set"} />
          <MetricLine label="Platform" value={site.platform || "Not set"} />
          <MetricLine label="Timezone" value={site.timezone || "UTC"} />
          <MetricLine label="Plan" value={site.plan || "starter"} />
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Allowed origins</div>
          <div className="mt-3 space-y-2">
            {site.allowed_origins.length ? (
              site.allowed_origins.map((origin) => (
                <div key={origin} className="truncate rounded-md bg-white px-2 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                  {origin}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No origins configured.</p>
            )}
          </div>
        </div>
      </div>
    </Surface>
  )
}

function KeyOperationsCard({ insights }: { insights: BehaviorInsights }) {
  const keys = insights.operations.keys
  return (
    <Surface title="Key Operations" description="Active and historical tracker keys for this site.">
      <div className="space-y-3">
        {keys.map((key) => (
          <div key={`${key.key_type}-${key.key_prefix}-${key.created_at}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">{key.key_prefix || "revoked key"}</div>
              <div className="mt-1 text-xs text-slate-500">{cleanLabel(key.key_type)} · created {timeAgo(key.created_at)}</div>
            </div>
            <Badge variant="outline" className={cn(key.status === "active" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500")}>
              {cleanLabel(key.status)}
            </Badge>
          </div>
        ))}
        {!keys.length ? <p className="text-sm text-slate-500">No keys found for this site.</p> : null}
      </div>
    </Surface>
  )
}

function InfrastructureHealthCard({ insights }: { insights: BehaviorInsights }) {
  const latestRun = insights.operations.analysis_runs[0]
  return (
    <Surface title="Infrastructure Health" description="Service status based on current application configuration and recent pipeline data.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HealthRow icon={Database} label="ClickHouse" value="Healthy" />
        <HealthRow icon={Server} label="Kafka" value="Healthy" />
        <HealthRow icon={Workflow} label="Airflow" value={latestRun ? "Latest run found" : "Waiting"} />
        <HealthRow icon={ShieldCheck} label="Bridge auth" value="Registry enabled" />
      </div>
    </Surface>
  )
}

function ReportExportCard({ insights }: { insights: BehaviorInsights }) {
  const siteId = insights.operations.site.site_id || "tdiscount"
  return (
    <Surface title="Report Actions" description="Export and reporting actions that will later become scheduled reports.">
      <div className="grid gap-3 md:grid-cols-3">
        <Button type="button" variant="outline" className="border-slate-200 bg-white text-slate-700" onClick={() => downloadReportCsv(insights)}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
          <Link href={`/debug?site_id=${encodeURIComponent(siteId)}`}>
            <Activity className="h-4 w-4" />
            Inspect data
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
          <Link href={`/emails?site_id=${encodeURIComponent(siteId)}`}>
            <Send className="h-4 w-4" />
            Email outbox
          </Link>
        </Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
          <Link href={`/connect?site_id=${encodeURIComponent(siteId)}`}>
            <Radio className="h-4 w-4" />
            Connect tracker
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
          <Link href={`/downloads?site_id=${encodeURIComponent(siteId)}`}>
            <Download className="h-4 w-4" />
            Plugin packages
          </Link>
        </Button>
      </div>
      <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
        Current report window contains {fmtInt(insights.dataset.rows)} raw events and {fmtInt(insights.business_overview.reach.sessions)} sessions.
      </div>
    </Surface>
  )
}

function ComingReportCard() {
  return (
    <Surface title="Scheduled Reports" description="Next automation layer for customer-facing reports.">
      <div className="space-y-3">
        <HealthRow icon={LineChartIcon} label="Weekly PDF" value="Planned" />
        <HealthRow icon={Send} label="Automatic email" value="Planned" />
        <HealthRow icon={ShieldCheck} label="Tenant isolation" value="Ready" />
      </div>
    </Surface>
  )
}

type CopilotUiMessage = {
  role: "user" | "assistant"
  content: string
}

type CopilotSuggestedAction = {
  label: string
  href: string
  reason: string
}

type CopilotMeta = {
  mode: string
  model: string
  data_as_of: string
}

type StoredCopilotState = {
  messages: CopilotUiMessage[]
  actions: CopilotSuggestedAction[]
  meta: CopilotMeta | null
}

const defaultCopilotMessages: CopilotUiMessage[] = [
  {
    role: "assistant",
    content: "I can explain your store metrics, Smart Actions, recommendations, and where to go next. I only use the current site summary and platform knowledge.",
  },
]

function safeParseCopilotState(value: string | null): StoredCopilotState | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<StoredCopilotState>
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(
          (message): message is CopilotUiMessage =>
            Boolean(message) &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            message.content.trim().length > 0
        )
      : []
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.filter(
          (action): action is CopilotSuggestedAction =>
            Boolean(action) &&
            typeof action.label === "string" &&
            typeof action.href === "string" &&
            typeof action.reason === "string"
        )
      : []
    const meta =
      parsed.meta && typeof parsed.meta === "object"
        ? {
            mode: String(parsed.meta.mode || "mock"),
            model: String(parsed.meta.model || "rules-mock"),
            data_as_of: String(parsed.meta.data_as_of || ""),
          }
        : null

    return {
      messages: messages.length ? messages : defaultCopilotMessages,
      actions,
      meta,
    }
  } catch {
    return null
  }
}

function renderMarkdownInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\[[^\]]+]\([^)]+\)|`[^`]+`|\*\*[^*]+?\*\*|\*[^*]+?\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    const key = `${keyPrefix}-${match.index}`

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-inherit">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const splitIndex = token.indexOf("](")
      const label = token.slice(1, splitIndex)
      const href = token.slice(splitIndex + 2, -1)
      const safeHref = href.startsWith("/") || href.startsWith("http://") || href.startsWith("https://") ? href : "#"
      nodes.push(
        <a
          key={key}
          href={safeHref}
          target={safeHref.startsWith("http") ? "_blank" : undefined}
          rel={safeHref.startsWith("http") ? "noreferrer" : undefined}
          className="font-medium text-blue-700 underline decoration-blue-200 underline-offset-2 hover:text-blue-800"
        >
          {label}
        </a>
      )
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      )
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split(/\r?\n/)
  const blocks: ReactNode[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line) continue

    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      blocks.push(
        <div key={`heading-${index}`} className="mt-2 first:mt-0 text-[13px] font-semibold text-slate-950">
          {renderMarkdownInline(heading[2], `heading-${index}`)}
        </div>
      )
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""))
        index += 1
      }
      index -= 1
      blocks.push(
        <ul key={`list-${index}`} className="my-2 space-y-1 pl-4">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="list-disc marker:text-slate-400">
              {renderMarkdownInline(item, `list-${index}-${itemIndex}`)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""))
        index += 1
      }
      index -= 1
      blocks.push(
        <ol key={`ordered-${index}`} className="my-2 space-y-1 pl-4">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="list-decimal marker:text-slate-400">
              {renderMarkdownInline(item, `ordered-${index}-${itemIndex}`)}
            </li>
          ))}
        </ol>
      )
      continue
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="my-2 first:mt-0 last:mb-0">
        {renderMarkdownInline(line, `paragraph-${index}`)}
      </p>
    )
  }

  return <div className="space-y-1">{blocks}</div>
}

function CopilotDock({ siteId }: { siteId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<CopilotUiMessage[]>(defaultCopilotMessages)
  const [actions, setActions] = useState<CopilotSuggestedAction[]>([])
  const [showActions, setShowActions] = useState(false)
  const [meta, setMeta] = useState<CopilotMeta | null>(null)
  const [loadedStorageKey, setLoadedStorageKey] = useState("")
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const askRef = useRef<(question: string) => void>(() => {})

  const prompts = [
    "How is my business doing?",
    "What should I do next?",
    "Explain Smart Actions.",
    "Why are users abandoning carts?",
  ]

  const storageKey = useMemo(() => `behaviourai:copilot:${siteId || "default"}`, [siteId])
  const hasUserMessages = messages.some((message) => message.role === "user")
  const showStarterPrompts = !hasUserMessages && !isLoading

  useEffect(() => {
    setLoadedStorageKey("")
    setIsLoading(false)
    setShowActions(false)

    if (typeof window === "undefined") {
      setMessages(defaultCopilotMessages)
      setActions([])
      setMeta(null)
      setLoadedStorageKey(storageKey)
      return
    }

    const stored = safeParseCopilotState(window.localStorage.getItem(storageKey))
    setMessages(stored?.messages || defaultCopilotMessages)
    setActions(stored?.actions || [])
    setMeta(stored?.meta || null)
    setLoadedStorageKey(storageKey)
  }, [storageKey])

  useEffect(() => {
    if (typeof window === "undefined" || loadedStorageKey !== storageKey) return
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        messages,
        actions,
        meta,
      } satisfies StoredCopilotState)
    )
  }, [actions, loadedStorageKey, messages, meta, storageKey])

  useEffect(() => {
    if (!isOpen) return
    messagesEndRef.current?.scrollIntoView({ block: "end" })
  }, [isOpen, isLoading, messages])

  async function ask(question: string) {
    const clean = question.trim()
    if (!clean || isLoading) return

    const nextMessages: CopilotUiMessage[] = [...messages, { role: "user", content: clean }]
    setMessages(nextMessages)
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: siteId,
          question: clean,
          messages,
        }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || "Copilot could not answer right now.")
      }

      setMessages([...nextMessages, { role: "assistant", content: String(result.answer || "") }])
      setActions(Array.isArray(result.suggested_actions) ? result.suggested_actions : [])
      setShowActions(false)
      setMeta({
        mode: String(result.mode || "mock"),
        model: String(result.model || "rules-mock"),
        data_as_of: String(result.data_as_of || ""),
      })
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Copilot could not answer right now.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  askRef.current = (question: string) => {
    setIsOpen(true)
    void ask(question)
  }

  useEffect(() => {
    function handleCommandBarAsk(event: Event) {
      const customEvent = event as CustomEvent<{ question?: string }>
      const question = String(customEvent.detail?.question || "").trim()
      if (!question) return
      askRef.current(question)
    }

    window.addEventListener("behaviourai:copilot:ask", handleCommandBarAsk)
    return () => window.removeEventListener("behaviourai:copilot:ask", handleCommandBarAsk)
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void ask(input)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen ? (
        <div className="mb-3 flex h-[min(720px,calc(100vh-48px))] w-[min(440px,calc(100vw-40px))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue-600 text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-950">AI Copilot</div>
                <div className="truncate text-xs text-slate-500">
                  {meta ? `${meta.mode} · ${meta.model} · data ${timeAgo(meta.data_as_of)}` : "Site-aware business assistant"}
                </div>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  "max-w-[88%] rounded-lg px-3 py-2 text-sm leading-6 shadow-sm",
                  message.role === "user"
                    ? "ml-auto bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                )}
              >
                {message.role === "assistant" ? <MarkdownMessage content={message.content} /> : message.content}
              </div>
            ))}
            {isLoading ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-100 bg-white px-4 py-3">
            {actions.length ? (
              <div className="mb-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowActions((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {showActions ? "Hide suggested actions" : `${actions.length} suggested actions`}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-700"
                    onClick={() => {
                      setActions([])
                      setShowActions(false)
                    }}
                    aria-label="Dismiss suggested actions"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {showActions ? (
                  <div className="mt-2 grid max-h-36 gap-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
                    {actions.map((action) => (
                      <Link
                        key={`${action.label}-${action.href}`}
                        href={action.href}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <div className="font-semibold text-slate-950">{action.label}</div>
                        <div className="mt-0.5 line-clamp-2 leading-5 text-slate-500">{action.reason}</div>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {showStarterPrompts ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void ask(prompt)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
            <form onSubmit={submit} className="flex gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void ask(input)
                  }
                }}
                rows={2}
                placeholder="Ask about this website..."
                className="min-h-10 flex-1 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
              <Button type="submit" disabled={isLoading || !input.trim()} className="h-auto bg-blue-600 px-3 hover:bg-blue-700">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      <Button type="button" onClick={() => setIsOpen((current) => !current)} className="h-12 rounded-full bg-blue-600 px-5 shadow-xl shadow-blue-900/20 hover:bg-blue-700">
        <MessageCircle className="h-4 w-4" />
        AI Copilot
      </Button>
    </div>
  )
}

function ActiveViewContent({
  view,
  insights,
  aiInsights,
  isAiInsightsLoading = false,
}: {
  view: DashboardView
  insights: BehaviorInsights
  aiInsights?: LiveAiInsightBundle | null
  isAiInsightsLoading?: boolean
}) {
  const { tr } = useI18n()

  switch (view) {
    case "live":
      return (
        <>
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard label={tr("Raw events")} value={fmtInt(insights.business_overview.reach.raw_events)} helper={tr("Events in the current analysis window")} icon={Activity} tone="blue" />
            <MetricCard label={tr("Recent stream")} value={fmtInt(insights.operations.recent_events.length)} helper={tr("Rows loaded into the live stream")} icon={Radio} tone="teal" />
            <MetricCard label={tr("Event types")} value={fmtInt(Object.keys(insights.event_mix).length)} helper={tr("Distinct event names observed")} icon={Layers3} tone="indigo" />
            <MetricCard label={tr("Freshness")} value={timeAgo(insights.operations.recent_events[0]?.received_at || insights.dataset.date_range_utc.max)} helper={tr("Latest accepted event")} icon={RefreshCw} tone="amber" />
          </section>
          <section className="grid gap-5 xl:grid-cols-3">
            <LiveEventStream insights={insights} />
            <EventMixCard insights={insights} />
          </section>
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <DataCoverageCard insights={insights} />
            <EventCaptureHealthCard insights={insights} />
          </section>
        </>
      )
    case "funnels":
      return (
        <>
          <section className="grid gap-5 xl:grid-cols-3">
            <FunnelCard insights={insights} />
            <TrendsCard insights={insights} />
          </section>
          <AIAlertCard insights={insights} aiInsights={aiInsights} isAiInsightsLoading={isAiInsightsLoading} />
        </>
      )
    case "audience":
      return (
        <>
          <TrafficCard insights={insights} />
          <section className="grid gap-5 xl:grid-cols-2">
            <DeviceMixCard insights={insights} />
            <CustomerSignalsCard insights={insights} />
          </section>
          <SessionQualityCard insights={insights} />
        </>
      )
    case "products":
      return (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <ProductEngagementCard insights={insights} />
            <EventMixCard insights={insights} />
          </section>
          <ReportExportCard insights={insights} />
        </>
      )
    case "smart-actions":
      return (
        <>
          <SmartActionsDashboard insights={insights} />
          <CommandBar />
        </>
      )
    case "smart-intent":
      return (
        <>
          <PurchaseIntentCard insights={insights} />
          <CommandBar />
        </>
      )
    case "smart-recommendations":
      return (
        <>
          <RecommendationAutomationCard insights={insights} />
          <SmartActionGuardrailsCard insights={insights} />
          <CommandBar />
        </>
      )
    case "reports":
      return (
        <>
          <section className="grid gap-5 xl:grid-cols-3">
            <TrendsCard insights={insights} />
            <EventMixCard insights={insights} />
          </section>
          <ReportExportCard insights={insights} />
          <ComingReportCard />
        </>
      )
    case "sites":
      return (
        <>
          <SiteControlsCard insights={insights} />
          <section className="grid gap-5 xl:grid-cols-2">
            <SiteConfigurationCard insights={insights} />
            <KeyOperationsCard insights={insights} />
          </section>
          <InfrastructureHealthCard insights={insights} />
        </>
      )
    case "pipelines":
      return (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <PipelineHealthCard insights={insights} />
            <ModelReadinessCard insights={insights} />
          </section>
          <InfrastructureHealthCard insights={insights} />
          <DataCoverageCard insights={insights} />
        </>
      )
    case "settings":
      return (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <SiteConfigurationCard insights={insights} />
            <KeyOperationsCard insights={insights} />
          </section>
          <SiteControlsCard insights={insights} />
          <DataCoverageCard insights={insights} />
        </>
      )
    case "overview":
    default:
      return (
        <>
          <SalesPerformanceSection insights={insights} />

          <BusinessPulsePanel insights={insights} />

          <ExecutiveShortcutGrid insights={insights} />

          <SmartActionsPreviewCard insights={insights} />

          <section className="grid gap-5 xl:grid-cols-2">
            <FunnelCard insights={insights} />
            <ProductEngagementCard insights={insights} />
          </section>

          <CommandBar />
        </>
      )
  }
}

export function DashboardPageClient({
  insights,
  initialView,
  sites = [],
  selectedSiteId,
  lookbackDays = 7,
  userEmail = "",
  userRole = "owner",
  userFullName = "",
  userAvatarUrl = "",
}: {
  insights: BehaviorInsights
  initialView?: string
  sites?: DashboardSite[]
  selectedSiteId?: string
  lookbackDays?: number
  userEmail?: string
  userRole?: string
  userFullName?: string
  userAvatarUrl?: string
}) {
  const { t } = useI18n()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isPageHeaderOpen, setIsPageHeaderOpen] = useState(true)
  const [aiInsights, setAiInsights] = useState<LiveAiInsightBundle | null>(null)
  const [isAiInsightsLoading, setIsAiInsightsLoading] = useState(false)
  const activeView = normalizeView(initialView)
  const viewKey = viewTranslationKeys[activeView]
  const meta = {
    title: t(`view.${viewKey}.title`),
    description: t(`view.${viewKey}.description`),
  }
  const site = insights.operations.site
  const currentSite: DashboardSite = {
    site_id: site.site_id || selectedSiteId || "",
    tenant_id: site.tenant_id,
    domain: site.domain,
    platform: site.platform,
    status: site.status,
  }
  const sidebarSites = sites.length
    ? sites
    : currentSite.site_id
      ? [currentSite]
      : []
  const selectedSidebarSite = sidebarSites.find((item) => item.site_id === (selectedSiteId || currentSite.site_id)) || currentSite
  const activeSiteId = site.site_id || selectedSiteId || selectedSidebarSite.site_id || "tdiscount"
  const latestEvent = insights.operations.recent_events[0]?.received_at || insights.dataset.date_range_utc.max
  const topbarNotifications = useMemo(() => buildTopbarNotifications(insights, activeSiteId), [activeSiteId, insights])

  const overviewTrend = insights.daily_trends.map((row) => ({
    date: row.date.slice(5),
    events: row.events,
    sessions: row.sessions,
  }))

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (saved === "false") {
      setIsSidebarOpen(false)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarOpen))
  }, [isSidebarOpen])

  useEffect(() => {
    const saved = window.localStorage.getItem(PAGE_HEADER_STORAGE_KEY)
    if (saved === "false") {
      setIsPageHeaderOpen(false)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(PAGE_HEADER_STORAGE_KEY, String(isPageHeaderOpen))
  }, [isPageHeaderOpen])

  useEffect(() => {
    if (!activeSiteId) return

    const controller = new AbortController()
    setIsAiInsightsLoading(true)

    fetch("/api/copilot/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: activeSiteId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(result.error || "AI insights could not be generated.")
        }
        setAiInsights(result as LiveAiInsightBundle)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setAiInsights(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsAiInsightsLoading(false)
        }
      })

    return () => controller.abort()
  }, [activeSiteId, latestEvent])

  const handleRefresh = async () => {
    const siteId = site.site_id || selectedSiteId
    if (!siteId) {
      window.location.reload()
      return
    }

    setIsRefreshing(true)
    setRefreshMessage(t("refresh.starting"))

    try {
      const response = await fetch("/api/analysis/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId, lookback_hours: 24 }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || t("refresh.failed"))
      }

      setRefreshMessage(t("refresh.queued"))
      window.setTimeout(() => window.location.reload(), 2500)
    } catch (error) {
      setIsRefreshing(false)
      setRefreshMessage(error instanceof Error ? error.message : t("refresh.failed"))
    }
  }

  const togglePageHeader = () => setIsPageHeaderOpen((value) => !value)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div
        className={cn(
          "grid min-h-screen transition-[grid-template-columns] duration-300 ease-out lg:grid-rows-[4rem_1fr]",
          isSidebarOpen
            ? "lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_360px]"
            : "lg:grid-cols-[72px_minmax(0,1fr)] xl:grid-cols-[72px_minmax(0,1fr)_360px]"
        )}
      >
        <Sidebar
          sites={sidebarSites}
          currentSite={selectedSidebarSite}
          activeView={activeView}
          isCollapsed={!isSidebarOpen}
          lookbackDays={lookbackDays}
          onToggleSidebar={() => setIsSidebarOpen((value) => !value)}
        />

        <div className="min-w-0 lg:col-start-2 lg:row-start-1 xl:col-end-4">
          <Topbar
            siteLabel={site.domain || site.site_id || "tdiscount"}
            siteId={site.site_id || "tdiscount"}
            latestEvent={latestEvent}
            activeView={activeView}
            lookbackDays={lookbackDays}
            notifications={topbarNotifications}
            userEmail={userEmail}
            userRole={userRole}
            userFullName={userFullName}
            userAvatarUrl={userAvatarUrl}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen((value) => !value)}
          />
        </div>

        <main className="min-w-0 lg:col-start-2 lg:row-start-2">
          <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 md:px-6">
            <section
              role="button"
              tabIndex={0}
              aria-expanded={isPageHeaderOpen}
              onClick={togglePageHeader}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  togglePageHeader()
                }
              }}
              className={cn(
                "cursor-pointer rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none transition-all duration-300 ease-out hover:border-blue-200 focus-visible:ring-2 focus-visible:ring-blue-100",
                isPageHeaderOpen ? "p-5" : "p-3"
              )}
            >
              <div
                aria-hidden={!isPageHeaderOpen}
                className={cn(
                  "grid overflow-hidden transition-[grid-template-rows,opacity,transform] duration-300 ease-out",
                  isPageHeaderOpen ? "grid-rows-[1fr] translate-y-0 opacity-100" : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0"
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50" variant="outline">
                          {site.platform || "wordpress"}
                        </Badge>
                        <StatusDot status={site.status === "active" ? "healthy" : "warning"} label={site.status || "active"} />
                        <span className="text-xs text-slate-400">{t("common.siteId")}: {site.site_id}</span>
                      </div>
                      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-[32px] md:leading-10">
                        {meta.title}
                      </h1>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                        {meta.description}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-medium text-slate-500">{t("common.datasetFreshness")}</div>
                          <div className="mt-1 text-lg font-semibold text-slate-950">{timeAgo(latestEvent)}</div>
                        </div>
                        <Button
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleRefresh()
                          }}
                          disabled={isRefreshing}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                          {isRefreshing ? t("common.refreshing") : t("common.refresh")}
                        </Button>
                      </div>
                      {refreshMessage ? <div className="mt-2 text-xs leading-5 text-slate-500">{refreshMessage}</div> : null}
                      <div className="mt-4 h-20">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={overviewTrend}>
                            <defs>
                              <linearGradient id="eventFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1769E8" stopOpacity={0.28} />
                                <stop offset="95%" stopColor="#1769E8" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Tooltip />
                            <Area type="monotone" dataKey="events" stroke="#1769E8" fill="url(#eventFill)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                aria-hidden={isPageHeaderOpen}
                className={cn(
                  "grid overflow-hidden transition-[grid-template-rows,opacity,transform] duration-300 ease-out",
                  isPageHeaderOpen ? "pointer-events-none grid-rows-[0fr] translate-y-1 opacity-0" : "grid-rows-[1fr] translate-y-0 opacity-100"
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ChevronDown className="h-4 w-4 -rotate-90 text-slate-400 transition-transform duration-300" />
                      <div className="min-w-0">
                        <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950">{meta.title}</h1>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{site.platform || "website"}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>{t("common.siteId")}: {site.site_id}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="text-right">
                        <div className="text-[11px] font-medium text-slate-500">{t("common.datasetFreshness")}</div>
                        <div className="text-sm font-semibold text-slate-950">{timeAgo(latestEvent)}</div>
                      </div>
                      <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-blue-600 hover:bg-blue-700">
                        <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                        {isRefreshing ? t("common.refreshing") : t("common.refresh")}
                      </Button>
                    </div>
                    {refreshMessage ? <div className="basis-full text-xs leading-5 text-slate-500">{refreshMessage}</div> : null}
                  </div>
                </div>
              </div>
            </section>

            <ActiveViewContent view={activeView} insights={insights} aiInsights={aiInsights} isAiInsightsLoading={isAiInsightsLoading} />
          </div>
        </main>

        <RightPanel insights={insights} aiInsights={aiInsights} isAiInsightsLoading={isAiInsightsLoading} />
      </div>
      <CopilotDock siteId={activeSiteId} />
    </div>
  )
}
