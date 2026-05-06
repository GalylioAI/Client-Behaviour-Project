"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Database,
  Download,
  Gauge,
  Globe2,
  KeyRound,
  Layers3,
  LayoutDashboard,
  LineChart as LineChartIcon,
  LogOut,
  PackageSearch,
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
import {
  buildDataQuality,
  buildEventMix,
  buildFunnel,
  buildKpis,
  buildProductInsights,
  buildTopProducts,
  buildTopReferrers,
} from "@/lib/dashboard-adapter"
import type { BehaviorInsights } from "@/lib/insights"
import { cn } from "@/lib/utils"

const chartColors = ["#1769E8", "#14B8A6", "#6366F1", "#F59E0B", "#EF4444", "#64748B"]

type DashboardView =
  | "overview"
  | "live"
  | "funnels"
  | "audience"
  | "products"
  | "ai"
  | "reports"
  | "sites"
  | "pipelines"
  | "settings"

const viewMeta: Record<DashboardView, { title: string; description: string }> = {
  overview: {
    title: "Business Performance Cockpit",
    description: "A compact owner view showing how the store is performing, what changed against the normal daily average, and where to act next.",
  },
  live: {
    title: "Live Events",
    description: "Watch accepted tracker events, event mix, recent traffic sources, and data freshness for this site.",
  },
  funnels: {
    title: "Funnels",
    description: "Understand where sessions move from product discovery to cart, checkout, and purchase.",
  },
  audience: {
    title: "Audience",
    description: "Review visitor loyalty, session quality, traffic channels, devices, and customer account signals.",
  },
  products: {
    title: "Products",
    description: "Rank products by views, clicks, add-to-cart activity, and engagement opportunities.",
  },
  ai: {
    title: "AI Insights",
    description: "Rules-based recommendations today, with model readiness signals for future ML scoring.",
  },
  reports: {
    title: "Reports",
    description: "Reusable reporting views for trends, event mix, traffic, exports, and operational quality.",
  },
  sites: {
    title: "Sites",
    description: "Manage the current website, installation status, plugin connection, and tenant boundaries.",
  },
  pipelines: {
    title: "Pipelines",
    description: "Monitor Layer 2 analysis jobs, infrastructure health, and data processing readiness.",
  },
  settings: {
    title: "Settings",
    description: "Review site configuration, allowed origins, platform, timezone, and security controls.",
  },
}

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, view: "overview" as const },
  { label: "Live Events", icon: Activity, view: "live" as const },
  { label: "Funnels", icon: BarChart3, view: "funnels" as const },
  { label: "Audience", icon: Users, view: "audience" as const },
  { label: "Products", icon: PackageSearch, view: "products" as const },
  { label: "AI Insights", icon: Brain, view: "ai" as const },
  { label: "Reports", icon: LineChartIcon, view: "reports" as const },
  { label: "Sites", icon: Globe2, view: "sites" as const },
  { label: "API Keys", icon: KeyRound, href: "/keys" },
  { label: "Pipelines", icon: Workflow, view: "pipelines" as const },
  { label: "Settings", icon: Settings, view: "settings" as const },
]

function normalizeView(value: string | null | undefined): DashboardView {
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
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
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
  children,
}: {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]", className)}>
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-slate-950">{title}</h2> : null}
            {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

function Sidebar({ siteDomain, siteId, activeView }: { siteDomain: string; siteId: string; activeView: DashboardView }) {
  const siteQuery = siteId ? `?site_id=${encodeURIComponent(siteId)}` : ""
  const appHref = (view: DashboardView) => `/app?site_id=${encodeURIComponent(siteId)}&view=${encodeURIComponent(view)}`

  return (
    <aside className="hidden h-screen border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 text-white shadow-sm">
          <Activity className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-950">BehaviourAI</div>
          <div className="text-xs text-slate-500">Intelligence platform</div>
        </div>
      </div>

      <div className="border-b border-slate-100 px-4 py-4">
        <button className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left">
          <span>
            <span className="block text-xs font-semibold text-slate-900">Demo Store</span>
            <span className="block truncate text-xs text-slate-500">{siteDomain || "tdiscount.tn"}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-3">
        {navigation.map((item) => {
          const content = (
            <>
              <item.icon className="h-4 w-4" />
              {item.label}
            </>
          )
          const className = cn(
            "flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
            item.view === activeView ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          )

          return item.view ? (
            <Link key={item.label} href={appHref(item.view)} className={className}>
              {content}
            </Link>
          ) : item.href ? (
            <Link key={item.label} href={`${item.href}${siteQuery}`} className={className}>
              {content}
            </Link>
          ) : (
            <button key={item.label} className={className}>
              {content}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <button className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-500 hover:bg-slate-100">
          <ChevronDown className="h-4 w-4 rotate-90" />
          Collapse
        </button>
      </div>
    </aside>
  )
}

function Topbar({ siteLabel, siteId, latestEvent }: { siteLabel: string; siteId: string; latestEvent: string | null }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Badge className="border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50" variant="outline">
          <Radio className="h-3 w-3" />
          Live
        </Badge>
        <div className="hidden min-w-0 md:block">
          <div className="truncate text-sm font-semibold text-slate-950">{siteLabel}</div>
          <div className="text-xs text-slate-500">Last event {timeAgo(latestEvent)}</div>
        </div>
      </div>

      <div className="hidden h-9 min-w-[280px] max-w-[420px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 lg:flex">
        <Search className="h-4 w-4 text-slate-400" />
        <span className="text-sm text-slate-500">Search events, users, funnels...</span>
        <kbd className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-400">⌘K</kbd>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" className="hidden border-slate-200 bg-white text-slate-700 md:inline-flex">
          <Link href={`/keys?site_id=${encodeURIComponent(siteId)}`}>
            <KeyRound className="h-4 w-4" />
            API Keys
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="hidden border-slate-200 bg-white text-slate-700 md:inline-flex">
          <Link href="/setup">
            <KeyRound className="h-4 w-4" />
            Setup
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="hidden border-slate-200 bg-white text-slate-700 md:inline-flex">
          <Link href={`/debug?site_id=${encodeURIComponent(siteId)}`}>
            <Activity className="h-4 w-4" />
            Debug
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="hidden border-slate-200 bg-white text-slate-700 md:inline-flex">
          <CalendarDays className="h-4 w-4" />
          Last 7 days
        </Button>
        <Button variant="ghost" size="icon-sm" className="text-slate-500">
          <Bell className="h-4 w-4" />
        </Button>
        <div className="hidden h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 md:flex">
          <div className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">IS</div>
          <span className="text-xs font-medium text-slate-700">Admin</span>
        </div>
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
  const [range, setRange] = useState<SalesRange>("daily")
  const sales = useMemo(() => buildSalesView(insights, range), [insights, range])
  const hasRevenue = sales.totals.revenue > 0

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sales / Revenue</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Confirmed Revenue</h2>
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
                {item.label}
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
          {hasRevenue ? `Compared with the ${sales.rangeConfig.compareLabel}` : "Waiting for purchase events with order totals"}
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
                  name === "revenue" ? "Revenue" : "Average",
                ]}
                labelFormatter={(label) => `Period: ${label}`}
              />
              <Line type="monotone" dataKey="average" stroke="#94A3B8" strokeDasharray="5 5" strokeWidth={1.4} dot={false} />
              <Area type="monotone" dataKey="revenue" stroke="#1769E8" fill="url(#salesRevenueFill)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <aside className="space-y-4">
        <SalesMetricCard
          title="Conversion Rate"
          value={fmtPct(sales.conversionRate)}
          delta={sales.conversionDelta}
          helper="Purchase sessions divided by total sessions."
        />
        <SalesMetricCard
          title="Average Order Value"
          value={fmtMoneyAmount(sales.averageOrderValue)}
          delta={sales.averageOrderValueDelta}
          helper="Revenue divided by completed purchases."
        />
        <SalesMetricCard
          title="Cart Abandonment"
          value={fmtPct(sales.cartAbandonmentRate)}
          delta={sales.cartAbandonmentDelta}
          positiveWhenUp={false}
          helper="Users who added to cart but left without buying."
        />
      </aside>
    </section>
  )
}

function BusinessPulseRow({ metric }: { metric: BusinessPulseMetric }) {
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
          <span className="truncate text-sm font-semibold text-slate-950">{metric.label}</span>
          {tone === "positive" ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : tone === "negative" ? <TrendingDown className="h-4 w-4 text-red-600" /> : null}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">{metric.sublabel} · {metric.baselineLabel}</div>
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
  const metrics = buildPulseMetrics(insights)
  return (
    <Surface
      title="Business Pulse"
      description="Current store performance compared with the normal daily average. Open any row for the full panel."
      action={<Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50">Stock-style movement</Badge>}
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
  const siteId = insights.operations.site.site_id || "tdiscount"
  const topProduct = buildTopProducts(insights)[0]
  const topReferrer = buildTopReferrers(insights)[0]
  const dropoff = insights.commercial_funnel.largest_dropoff
  const shortcuts = [
    {
      title: "Biggest Revenue Leak",
      value: `${dropoff.dropoff_pct_points.toFixed(1)} pts`,
      helper: `${cleanLabel(dropoff.from_stage)} to ${cleanLabel(dropoff.to_stage)}`,
      href: `/app?site_id=${encodeURIComponent(siteId)}&view=funnels`,
      icon: BarChart3,
      tone: "red",
    },
    {
      title: "Product Opportunity",
      value: topProduct ? topProduct.label : "Waiting",
      helper: topProduct ? topProduct.secondaryValue : "No product signal yet",
      href: `/app?site_id=${encodeURIComponent(siteId)}&view=products`,
      icon: PackageSearch,
      tone: "blue",
    },
    {
      title: "Best Traffic Signal",
      value: topReferrer ? topReferrer.label : "Direct",
      helper: topReferrer ? topReferrer.secondaryValue : "No referrer signal yet",
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
          <div className="mt-4 text-xs font-medium text-slate-500">{item.title}</div>
          <div className="mt-2 line-clamp-1 text-xl font-semibold text-slate-950">{item.value}</div>
          <div className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{item.helper}</div>
        </Link>
      ))}
    </section>
  )
}

function FunnelCard({ insights }: { insights: BehaviorInsights }) {
  const funnel = buildFunnel(insights)
  const max = Math.max(...funnel.stages.map((stage) => stage.value), 1)
  return (
    <Surface
      title="Conversion Funnel"
      description={`Overall conversion ${fmtPct(funnel.totalConversionRate)} from sessions to purchase.`}
      action={<StatusDot status="processing" label="Layer 2" />}
    >
      <div className="space-y-4">
        {funnel.stages.map((stage, index) => (
          <div key={stage.id} className="grid gap-2">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="font-medium text-slate-700">{stage.name}</span>
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
  const events = insights.operations.recent_events
  return (
    <Surface
      title="Real-time Event Stream"
      description={`${fmtInt(insights.dataset.rows)} raw events observed in the current window.`}
      action={<StatusDot status={events.length ? "healthy" : "neutral"} label={events.length ? "Receiving" : "Waiting"} />}
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
                <span className="text-sm font-semibold text-slate-950">{cleanLabel(event.event_name)}</span>
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
            No recent events for this site yet.
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

function AIAlertCard({ insights }: { insights: BehaviorInsights }) {
  const dropoff = insights.commercial_funnel.largest_dropoff
  const productNotes = buildProductInsights(insights)
  const topNote = productNotes[0]
  return (
    <Surface
      title="AI Opportunity Alert"
      description="Deterministic insight today, ready to become ML-backed later."
      className="border-red-100 bg-gradient-to-br from-white to-red-50/40"
      action={<Badge className="border-red-100 bg-red-50 text-red-700 hover:bg-red-50" variant="outline">High impact</Badge>}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{topNote?.title || "Largest conversion leak detected"}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {topNote?.description ||
              `The biggest decline is from ${cleanLabel(dropoff.from_stage)} to ${cleanLabel(dropoff.to_stage)}.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-white">Drop-off {dropoff.dropoff_pct_points.toFixed(2)} pts</Badge>
            <Badge variant="outline" className="bg-white">Confidence: rules based</Badge>
          </div>
        </div>
      </div>
    </Surface>
  )
}

function ProductEngagementCard({ insights }: { insights: BehaviorInsights }) {
  const rows = buildTopProducts(insights).slice(0, 5)
  return (
    <Surface title="Product Engagement" description="Products ranked by views and observed engagement events.">
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">{index + 1}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{row.label}</div>
              <div className="text-xs text-slate-500">{row.secondaryValue}</div>
            </div>
            <div className="text-sm font-semibold tabular-nums text-slate-950">{fmtInt(row.value)}</div>
          </div>
        ))}
        {!rows.length ? <p className="text-sm text-slate-500">No product events captured yet.</p> : null}
      </div>
    </Surface>
  )
}

function SessionQualityCard({ insights }: { insights: BehaviorInsights }) {
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
    <Surface title="Session Quality Score" description="Composite of coverage, engagement depth, and visitor loyalty.">
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
              <div className="text-xs text-slate-500">Good</div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <MetricLine label="Avg events/session" value={insights.audience.engagement.avg_events_per_session.toFixed(2)} />
          <MetricLine label="Median duration" value={`${insights.audience.engagement.median_session_duration_sec.toFixed(0)}s`} />
          <MetricLine label="Repeat visitors" value={fmtPct(insights.business_overview.reach.repeat_visitor_rate_pct)} />
          <MetricLine label="Data coverage" value={fmtPct(quality.overallCoverage)} />
        </div>
      </div>
    </Surface>
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
  const trendData = insights.daily_trends.map((row) => ({
    date: row.date.slice(5),
    sessions: row.sessions,
    carts: row.add_to_cart,
    purchases: row.purchases,
  }))
  return (
    <Surface title="Daily Behaviour Trend" description="Sessions, carts, and purchases over the current analysis window." className="xl:col-span-2">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ left: 4, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} width={42} />
            <Tooltip />
            <Line type="monotone" dataKey="sessions" stroke="#1769E8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="carts" stroke="#14B8A6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="purchases" stroke="#F59E0B" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  )
}

function EventMixCard({ insights }: { insights: BehaviorInsights }) {
  const rows = buildEventMix(insights).slice(0, 8)
  return (
    <Surface title="Event Mix" description="Most frequent event names from Layer 2 aggregation.">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid stroke="#E2E8F0" horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} tick={{ fill: "#64748B", fontSize: 12 }} />
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
    { label: "Layer 2 features", value: insights.dataset.rows ? "Ready" : "Waiting", status: insights.dataset.rows ? "healthy" : "neutral" },
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
    <Surface title="Pipeline Health" description="Latest analysis jobs written by the Layer 2 workflow.">
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

function RightPanel({ insights }: { insights: BehaviorInsights }) {
  const site = insights.operations.site
  const keys = insights.operations.keys
  const latestRun = insights.operations.analysis_runs[0]
  const publicKeys = keys.filter((key) => key.key_type === "public_write")
  const secretKeys = keys.filter((key) => key.key_type === "server_secret")
  return (
    <aside className="hidden border-l border-slate-200 bg-slate-50/80 xl:block">
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

          <Surface title="AI Recommendations" className="shadow-none">
            <div className="space-y-3">
              {buildProductInsights(insights).slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-md border border-indigo-100 bg-indigo-50 p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 text-indigo-600" />
                    <div>
                      <div className="text-sm font-semibold text-indigo-950">{item.title}</div>
                      <div className="mt-1 line-clamp-3 text-xs leading-5 text-indigo-800">{item.description}</div>
                    </div>
                  </div>
                </div>
              ))}
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
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          placeholder="Ask AI about your data..."
        />
        <Button size="icon-sm" className="bg-blue-600 hover:bg-blue-700">
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 px-1">
        {["Why did conversion drop?", "Top products this week", "Compare mobile vs desktop"].map((prompt) => (
          <button key={prompt} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
            {prompt}
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
  const quality = buildDataQuality(insights)
  const rows = quality.columns.slice(0, 8)
  return (
    <Surface title="Data Coverage" description="How complete the important tracker fields are.">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.column} className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">{cleanLabel(row.column)}</span>
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
          <Link href="/emails">
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

type MetricCardData = {
  label: string
  value: string
  helper: string
  icon: typeof Activity
  tone: "blue" | "teal" | "indigo" | "amber"
}

function ActiveViewContent({
  view,
  insights,
  metricCards,
  kpis,
}: {
  view: DashboardView
  insights: BehaviorInsights
  metricCards: MetricCardData[]
  kpis: ReturnType<typeof buildKpis>
}) {
  switch (view) {
    case "live":
      return (
        <>
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard label="Raw events" value={fmtInt(insights.business_overview.reach.raw_events)} helper="Events in the current analysis window" icon={Activity} tone="blue" />
            <MetricCard label="Recent stream" value={fmtInt(insights.operations.recent_events.length)} helper="Rows loaded into the live stream" icon={Radio} tone="teal" />
            <MetricCard label="Event types" value={fmtInt(Object.keys(insights.event_mix).length)} helper="Distinct event names observed" icon={Layers3} tone="indigo" />
            <MetricCard label="Freshness" value={timeAgo(insights.operations.recent_events[0]?.received_at || insights.dataset.date_range_utc.max)} helper="Latest accepted event" icon={RefreshCw} tone="amber" />
          </section>
          <section className="grid gap-5 xl:grid-cols-3">
            <LiveEventStream insights={insights} />
            <EventMixCard insights={insights} />
          </section>
          <section className="grid gap-5 xl:grid-cols-2">
            <TrafficCard insights={insights} />
            <DataCoverageCard insights={insights} />
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
          <section className="grid gap-5 xl:grid-cols-2">
            <AIAlertCard insights={insights} />
            <SessionQualityCard insights={insights} />
          </section>
        </>
      )
    case "audience":
      return (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <DeviceMixCard insights={insights} />
            <CustomerSignalsCard insights={insights} />
          </section>
          <section className="grid gap-5 xl:grid-cols-2">
            <TrafficCard insights={insights} />
            <SessionQualityCard insights={insights} />
          </section>
        </>
      )
    case "products":
      return (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <ProductEngagementCard insights={insights} />
            <AIAlertCard insights={insights} />
          </section>
          <section className="grid gap-5 xl:grid-cols-2">
            <EventMixCard insights={insights} />
            <DataCoverageCard insights={insights} />
          </section>
        </>
      )
    case "ai":
      return (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <AIAlertCard insights={insights} />
            <ModelReadinessCard insights={insights} />
          </section>
          <section className="grid gap-5 xl:grid-cols-2">
            <ProductEngagementCard insights={insights} />
            <SessionQualityCard insights={insights} />
          </section>
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
          <section className="grid gap-5 xl:grid-cols-2">
            <TrafficCard insights={insights} />
            <ReportExportCard insights={insights} />
          </section>
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

          <section className="grid gap-5 xl:grid-cols-3">
            <TrendsCard insights={insights} />
            <AIAlertCard insights={insights} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <FunnelCard insights={insights} />
            <ProductEngagementCard insights={insights} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <TrafficCard insights={insights} />
            <SessionQualityCard insights={insights} />
          </section>

          <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] md:grid-cols-3">
            {kpis.slice(4, 6).map((item) => (
              <MetricLine key={item.id} label={item.label} value={item.formattedValue} />
            ))}
            <MetricLine label="Raw events" value={fmtInt(insights.business_overview.reach.raw_events)} />
          </section>

          <CommandBar />
        </>
      )
  }
}

export function DashboardPageClient({ insights, initialView }: { insights: BehaviorInsights; initialView?: string }) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const activeView = normalizeView(initialView)
  const meta = viewMeta[activeView]
  const kpis = buildKpis(insights)
  const site = insights.operations.site
  const latestEvent = insights.operations.recent_events[0]?.received_at || insights.dataset.date_range_utc.max

  const metricCards = useMemo(
    () => [
      {
        label: "Sessions",
        value: fmtInt(insights.business_overview.reach.sessions),
        helper: `${fmtInt(insights.business_overview.reach.visitors)} visitors in the current window`,
        icon: Users,
        tone: "blue" as const,
      },
      {
        label: "Purchase Rate",
        value: fmtPct(insights.business_overview.conversion.session_to_purchase_rate_pct),
        helper: `${fmtInt(insights.business_overview.conversion.purchase_sessions)} purchase sessions`,
        icon: CircleDollarSign,
        tone: "teal" as const,
      },
      {
        label: "Checkout Conversion",
        value: fmtPct(insights.business_overview.conversion.checkout_to_purchase_rate_pct),
        helper: "From checkout start to purchase completed",
        icon: Gauge,
        tone: "indigo" as const,
      },
      {
        label: "Observed Cart Value",
        value: fmtMoney(insights.business_overview.basket.avg_observed_cart_value_tnd),
        helper: `${fmtInt(insights.business_overview.basket.sessions_with_cart_value)} sessions with cart value`,
        icon: PackageSearch,
        tone: "amber" as const,
      },
    ],
    [insights]
  )

  const overviewTrend = insights.daily_trends.map((row) => ({
    date: row.date.slice(5),
    events: row.events,
    sessions: row.sessions,
  }))

  const handleRefresh = () => {
    setIsRefreshing(true)
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_360px]">
        <Sidebar siteDomain={site.domain} siteId={site.site_id || "tdiscount"} activeView={activeView} />

        <main className="min-w-0">
          <Topbar siteLabel={site.domain || site.site_id || "tdiscount"} siteId={site.site_id || "tdiscount"} latestEvent={latestEvent} />

          <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 md:px-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50" variant="outline">
                      {site.platform || "wordpress"}
                    </Badge>
                    <StatusDot status={site.status === "active" ? "healthy" : "warning"} label={site.status || "active"} />
                    <span className="text-xs text-slate-400">site_id: {site.site_id}</span>
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
                      <div className="text-xs font-medium text-slate-500">Dataset freshness</div>
                      <div className="mt-1 text-lg font-semibold text-slate-950">{timeAgo(latestEvent)}</div>
                    </div>
                    <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-blue-600 hover:bg-blue-700">
                      <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                      Refresh
                    </Button>
                  </div>
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
            </section>

            <ActiveViewContent view={activeView} insights={insights} metricCards={metricCards} kpis={kpis} />
          </div>
        </main>

        <RightPanel insights={insights} />
      </div>
    </div>
  )
}
