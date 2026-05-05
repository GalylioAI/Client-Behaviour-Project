"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Brain,
  CalendarDays,
  CheckCircle2,
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
  LockKeyhole,
  PackageSearch,
  Radio,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
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

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Live Events", icon: Activity },
  { label: "Funnels", icon: BarChart3 },
  { label: "Audience", icon: Users },
  { label: "Products", icon: PackageSearch },
  { label: "AI Insights", icon: Brain },
  { label: "Reports", icon: LineChartIcon },
  { label: "Sites", icon: Globe2 },
  { label: "API Keys", icon: KeyRound },
  { label: "Pipelines", icon: Workflow },
  { label: "Settings", icon: Settings },
]

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

function Sidebar({ siteDomain }: { siteDomain: string }) {
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
        {navigation.map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              item.active
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
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
  const referrers = buildTopReferrers(insights).slice(0, 5)
  const channels = insights.acquisition.channel_mix.slice(0, 5)
  return (
    <Surface title="Traffic And Referrals" description="Channels and referrers captured from session referrer data.">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={channels} dataKey="sessions" nameKey="channel" innerRadius={52} outerRadius={78} paddingAngle={3}>
                {channels.map((entry, index) => (
                  <Cell key={entry.channel} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {referrers.map((row, index) => (
            <div key={row.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">{row.label}</div>
                <div className="text-xs text-slate-500">{row.secondaryValue}</div>
              </div>
              <div className="text-sm font-semibold tabular-nums text-slate-950">{fmtInt(row.value)}</div>
            </div>
          ))}
          {!referrers.length ? <p className="text-sm text-slate-500">No referral data captured yet.</p> : null}
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

          <Surface title="API Key Status" className="shadow-none">
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

export function DashboardPageClient({ insights }: { insights: BehaviorInsights }) {
  const [isRefreshing, setIsRefreshing] = useState(false)
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
        <Sidebar siteDomain={site.domain} />

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
                    Live Behaviour Intelligence Dashboard
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    A focused operating view for real-time ecommerce behavior, conversion leaks, product engagement, tenant health, and the AI/ML layer we will grow next.
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

            <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {metricCards.map((card) => (
                <MetricCard key={card.label} {...card} />
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-3">
              <LiveEventStream insights={insights} />
              <FunnelCard insights={insights} />
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <TrafficCard insights={insights} />
              <AIAlertCard insights={insights} />
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <ProductEngagementCard insights={insights} />
              <SessionQualityCard insights={insights} />
            </section>

            <section className="grid gap-5 xl:grid-cols-3">
              <TrendsCard insights={insights} />
              <EventMixCard insights={insights} />
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <PipelineHealthCard insights={insights} />
              <ModelReadinessCard insights={insights} />
            </section>

            <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] md:grid-cols-3">
              {kpis.slice(4, 6).map((item) => (
                <MetricLine key={item.id} label={item.label} value={item.formattedValue} />
              ))}
              <MetricLine label="Raw events" value={fmtInt(insights.business_overview.reach.raw_events)} />
            </section>

            <CommandBar />
          </div>
        </main>

        <RightPanel insights={insights} />
      </div>
    </div>
  )
}
