import Link from "next/link"
import type { ReactNode } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  KeyRound,
  PlugZap,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AuditRow, DebugData, DebugSite, FieldHealth, RecentEventRow } from "@/lib/debug"
import { cn } from "@/lib/utils"

function fmtInt(value: number) {
  return Math.round(value || 0).toLocaleString()
}

function pct(missing: number, total: number) {
  if (!total) return "No data"
  return `${Math.max(0, 100 - (missing / total) * 100).toFixed(1)}%`
}

function clean(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown"
}

function compactUrl(value: string) {
  if (!value) return "No page"
  try {
    const parsed = new URL(value)
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}`
  } catch {
    return value.replace(/^https?:\/\//, "")
  }
}

function timeAgo(value: string | null) {
  if (!value) return "No data"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function Surface({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]", className)}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const accepted = status === "accepted"
  return (
    <Badge
      variant="outline"
      className={cn(
        accepted ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-red-100 bg-red-50 text-red-700"
      )}
    >
      {accepted ? <CheckCircle2 className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      {clean(status)}
    </Badge>
  )
}

function MetricCard({
  label,
  value,
  helper,
  tone = "blue",
  icon: Icon,
}: {
  label: string
  value: string
  helper: string
  tone?: "blue" | "emerald" | "red" | "amber"
  icon: typeof Activity
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
        </div>
        <div className={cn("grid h-8 w-8 place-items-center rounded-md", tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-xs leading-5 text-slate-500">{helper}</div>
    </div>
  )
}

function SiteRail({ sites, selectedSiteId }: { sites: DebugSite[]; selectedSiteId: string }) {
  return (
    <aside className="space-y-2">
      {sites.map((site) => {
        const active = site.site_id === selectedSiteId
        const healthy = site.rejected_1h === 0 && Boolean(site.last_event_at)
        return (
          <Link
            href={`/debug?site_id=${encodeURIComponent(site.site_id)}`}
            key={site.site_id}
            className={cn(
              "block rounded-lg border p-3 transition",
              active ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{site.domain || site.site_id}</div>
                <div className="truncate text-xs text-slate-500">{site.site_id} · {site.platform}</div>
              </div>
              <span className={cn("h-2 w-2 rounded-full", healthy ? "bg-emerald-500" : "bg-amber-500")} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-white/70 p-2">
                <div className="font-semibold text-slate-950">{fmtInt(site.events_5m)}</div>
                <div className="text-slate-500">5m events</div>
              </div>
              <div className="rounded-md bg-white/70 p-2">
                <div className="font-semibold text-slate-950">{fmtInt(site.rejected_1h)}</div>
                <div className="text-slate-500">1h rejected</div>
              </div>
            </div>
          </Link>
        )
      })}
      {!sites.length ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          No sites registered yet.
        </div>
      ) : null}
    </aside>
  )
}

function FieldHealthCard({ health }: { health: FieldHealth }) {
  const rows = [
    ["site_id", health.missing_site_id],
    ["session_id", health.missing_session_id],
    ["visitor_id", health.missing_visitor_id],
    ["event_name", health.missing_event_name],
    ["page_url", health.missing_page_url],
  ] as const

  return (
    <Surface title="Field Health" description="Coverage for accepted events in the last 24 hours.">
      <div className="space-y-3">
        {rows.map(([label, missing]) => (
          <div key={label} className="grid gap-2">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="font-medium text-slate-700">{label}</span>
              <span className="font-semibold tabular-nums text-slate-950">{pct(missing, health.total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full", missing ? "bg-amber-500" : "bg-emerald-500")}
                style={{ width: health.total ? `${Math.max(0, 100 - (missing / health.total) * 100)}%` : "0%" }}
              />
            </div>
          </div>
        ))}
      </div>
    </Surface>
  )
}

function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <Surface title="Webhook Requests" description="Accepted and rejected requests written by the bridge audit log." className="xl:col-span-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="py-3 pr-4">Time</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Event</th>
              <th className="py-3 pr-4">Key</th>
              <th className="py-3 pr-4">Origin</th>
              <th className="py-3 pr-4">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.audit_id} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-4 text-xs text-slate-500">
                  <div>{timeAgo(row.received_at)}</div>
                  <div>{row.client_ip}</div>
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={row.status} />
                  <div className="mt-1 text-xs text-slate-500">HTTP {row.http_status}</div>
                </td>
                <td className="py-3 pr-4">
                  <div className="font-medium text-slate-950">{clean(row.sample_event_name) || "No event"}</div>
                  <div className="text-xs text-slate-500">{row.event_count} event(s), sent {row.sent_count}</div>
                </td>
                <td className="py-3 pr-4">
                  <div className={cn("text-xs font-semibold", row.key_present ? "text-emerald-700" : "text-red-700")}>
                    {row.key_present ? "Present" : "Missing"}
                  </div>
                  <div className="text-xs text-slate-500">{row.key_prefix || "No prefix"}</div>
                </td>
                <td className="max-w-[220px] py-3 pr-4">
                  <div className="truncate text-xs text-slate-700">{row.origin || "No origin"}</div>
                  <div className="truncate text-xs text-slate-400">{row.platform || row.source || "unknown"}</div>
                </td>
                <td className="max-w-[280px] py-3 pr-4">
                  <div className="line-clamp-2 text-xs leading-5 text-slate-600">{row.reason || "Accepted"}</div>
                  <div className="truncate text-xs text-slate-400">{compactUrl(row.sample_page_url)}</div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                  No audited requests for this site yet. Trigger the tracker and refresh.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Surface>
  )
}

function RecentEvents({ rows }: { rows: RecentEventRow[] }) {
  return (
    <Surface title="Accepted Events" description="Latest rows that reached ClickHouse after bridge validation.">
      <div className="space-y-3">
        {rows.slice(0, 10).map((row) => (
          <div key={`${row.received_at}-${row.event_name}-${row.session_id}`} className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-slate-950">{clean(row.event_name)}</div>
              <div className="text-xs text-slate-500">{timeAgo(row.received_at)}</div>
            </div>
            <div className="mt-1 truncate text-xs text-slate-500">{compactUrl(row.page_url)}</div>
          </div>
        ))}
        {!rows.length ? <p className="text-sm text-slate-500">No accepted events yet.</p> : null}
      </div>
    </Surface>
  )
}

export function DebugPage({ data }: { data: DebugData }) {
  const selected = data.sites.find((site) => site.site_id === data.selectedSiteId)
  const accepted1h = selected?.accepted_1h || 0
  const rejected1h = selected?.rejected_1h || 0
  const bridge = data.bridge

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white">
              <PlugZap className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">Event Debugger</div>
              <div className="text-xs text-slate-500">Website to bridge to ClickHouse visibility</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <Link href="/start">
                <KeyRound className="h-4 w-4" />
                Start
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <Link href="/app">
                <ExternalLink className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/debug?site_id=${encodeURIComponent(data.selectedSiteId)}`}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 md:px-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <SiteRail sites={data.sites} selectedSiteId={data.selectedSiteId} />

        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">
                    {selected?.platform || "unknown"}
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                    site_id: {data.selectedSiteId}
                  </Badge>
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-[32px] md:leading-10">
                  {selected?.domain || data.selectedSiteId}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Use this page when a tracker is installed but data is missing, rejected, delayed, or malformed.
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <div className="font-semibold text-slate-900">Allowed origins</div>
                {(selected?.allowed_origins.length ? selected.allowed_origins : ["No origin restriction"]).map((origin) => (
                  <div key={origin}>{origin}</div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard label="Events 5m" value={fmtInt(selected?.events_5m || 0)} helper="Accepted events in ClickHouse" icon={Activity} />
            <MetricCard
              label="Accepted 1h"
              value={fmtInt(accepted1h)}
              helper={`Last accepted ${timeAgo(selected?.last_accepted_at || selected?.last_event_at || null)}`}
              icon={CheckCircle2}
              tone="emerald"
            />
            <MetricCard
              label="Rejected 1h"
              value={fmtInt(rejected1h)}
              helper={`Last rejected ${timeAgo(selected?.last_rejected_at || null)}`}
              icon={AlertTriangle}
              tone={rejected1h ? "red" : "emerald"}
            />
            <MetricCard
              label="Bridge"
              value={bridge.ok ? "Online" : "Offline"}
              helper={bridge.ok ? `${fmtInt(bridge.metrics.auth_rejected || 0)} auth rejects since restart` : bridge.error || "No bridge response"}
              icon={Server}
              tone={bridge.ok ? "blue" : "red"}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <Surface title="Bridge Health" description="Live `/health` and `/metrics` from PC1.">
              <div className="space-y-3">
                <HealthRow icon={Server} label="Bridge" value={bridge.ok ? "Online" : "Offline"} ok={bridge.ok} />
                <HealthRow icon={Database} label="Topic" value={bridge.health?.topic || "Unknown"} ok={bridge.ok} />
                <HealthRow icon={ShieldCheck} label="Registry auth" value={bridge.health?.site_registry_enabled ? "Enabled" : "Off"} ok={Boolean(bridge.health?.site_registry_enabled)} />
                <HealthRow icon={Radio} label="Audit log" value={bridge.health?.ingest_audit_enabled ? "Enabled" : "Off"} ok={Boolean(bridge.health?.ingest_audit_enabled)} />
              </div>
            </Surface>
            <FieldHealthCard health={data.fieldHealth} />
            <RecentEvents rows={data.recentEvents} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <AuditTable rows={data.audits} />
          </section>
        </div>
      </main>
    </div>
  )
}

function HealthRow({ icon: Icon, label, value, ok }: { icon: typeof Activity; label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </div>
      <Badge variant="outline" className={cn(ok ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-red-100 bg-red-50 text-red-700")}>
        {value}
      </Badge>
    </div>
  )
}
