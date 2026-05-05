"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Github,
  Globe2,
  KeyRound,
  LockKeyhole,
  PlugZap,
  Radio,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DebugData, DebugSite } from "@/lib/debug"
import { cn } from "@/lib/utils"

const WP_SOURCE_URL = "https://github.com/GalylioAI/Client-Behaviour-Project/tree/wp"
const PRESTA_SOURCE_URL = "https://github.com/GalylioAI/Client-Behaviour-Project/tree/Prestashop_module"

function copyText(value: string) {
  if (!value || value.startsWith("Shown once")) return
  void navigator.clipboard?.writeText(value)
}

function fmtInt(value: number) {
  return Math.round(value || 0).toLocaleString()
}

function clean(value: string) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown"
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

function sourceForPlatform(platform: string) {
  if (platform === "wordpress" || platform === "woocommerce") {
    return {
      label: "WordPress / WooCommerce tracker",
      url: WP_SOURCE_URL,
      folder: "wordpress-behaviour-tracker",
      settingsPath: "WordPress admin -> Settings -> Behaviour Tracker",
    }
  }

  if (platform === "prestashop") {
    return {
      label: "PrestaShop tracker module",
      url: PRESTA_SOURCE_URL,
      folder: "behaviourtracker",
      settingsPath: "PrestaShop admin -> Modules -> Customer Behaviour Tracker -> Configure",
    }
  }

  return {
    label: "Custom tracker integration",
    url: WP_SOURCE_URL,
    folder: "custom",
    settingsPath: "Use the webhook and keys in your custom integration",
  }
}

function Surface({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]", className)}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function StepRow({
  index,
  title,
  description,
  done,
  warning,
}: {
  index: number
  title: string
  description: string
  done: boolean
  warning?: boolean
}) {
  return (
    <div className="grid grid-cols-[32px_1fr_auto] gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
      <div
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ring-1",
          done
            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
            : warning
              ? "bg-amber-50 text-amber-700 ring-amber-100"
              : "bg-white text-slate-500 ring-slate-200"
        )}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : index}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-950">{title}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "h-fit",
          done
            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
            : warning
              ? "border-amber-100 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-white text-slate-500"
        )}
      >
        {done ? "Done" : warning ? "Check" : "Waiting"}
      </Badge>
    </div>
  )
}

function Metric({
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
  tone?: "blue" | "emerald" | "amber" | "red"
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
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

function CopyLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <code className={cn("block truncate text-xs font-medium", muted ? "text-slate-500" : "text-slate-800")}>{value}</code>
      </div>
      <Button type="button" variant="ghost" size="icon-sm" className="text-slate-500" onClick={() => copyText(value)} disabled={muted}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  )
}

function SiteSwitcher({ sites, selectedSiteId }: { sites: DebugSite[]; selectedSiteId: string }) {
  return (
    <Surface title="Registered Sites" description="Choose the website you are connecting." className="shadow-none">
      <div className="space-y-2">
        {sites.map((site) => (
          <Link
            key={site.site_id}
            href={`/connect?site_id=${encodeURIComponent(site.site_id)}`}
            className={cn(
              "block rounded-md border p-3 transition",
              site.site_id === selectedSiteId ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{site.domain || site.site_id}</div>
                <div className="truncate text-xs text-slate-500">{site.site_id} · {site.platform}</div>
              </div>
              <span className={cn("h-2 w-2 rounded-full", site.last_event_at ? "bg-emerald-500" : "bg-amber-500")} />
            </div>
          </Link>
        ))}
      </div>
    </Surface>
  )
}

export function ConnectPage({ data }: { data: DebugData }) {
  const selected = data.sites.find((site) => site.site_id === data.selectedSiteId)
  const platform = selected?.platform || "prestashop"
  const plugin = sourceForPlatform(platform)
  const lastRejected = selected?.last_rejected_at || null
  const lastAccepted = selected?.last_accepted_at || selected?.last_event_at || null
  const hasSite = Boolean(selected)
  const hasKeys = Boolean((selected?.public_key_count || 0) > 0)
  const hasBridge = data.bridge.ok && Boolean(data.bridge.health?.site_registry_enabled)
  const hasAccepted = Boolean(lastAccepted)
  const hasEvents = Boolean((selected?.events_24h || 0) > 0)
  const hasRejections = Boolean((selected?.rejected_1h || 0) > 0)
  const connected = hasSite && hasKeys && hasBridge && hasAccepted && hasEvents && !hasRejections

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white">
              <PlugZap className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">Connection Wizard</div>
              <div className="text-xs text-slate-500">Install tracker, verify keys, confirm first events</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <Link href={`/debug?site_id=${encodeURIComponent(data.selectedSiteId)}`}>
                <Activity className="h-4 w-4" />
                Debug
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <Link href={`/connect?site_id=${encodeURIComponent(data.selectedSiteId)}`}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Link>
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/?site_id=${encodeURIComponent(data.selectedSiteId)}`}>
                Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 md:px-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <SiteSwitcher sites={data.sites} selectedSiteId={data.selectedSiteId} />

          <Surface title="Trust And Transparency" description="The trackers are open source." className="shadow-none">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>
                Customers can inspect the plugin code themselves before installing it. This helps build trust because the tracker behavior is visible, not hidden.
              </p>
              <Button asChild variant="outline" className="w-full border-slate-200 bg-white text-slate-700">
                <a href={WP_SOURCE_URL} target="_blank" rel="noreferrer">
                  <Github className="h-4 w-4" />
                  WordPress source
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full border-slate-200 bg-white text-slate-700">
                <a href={PRESTA_SOURCE_URL} target="_blank" rel="noreferrer">
                  <Github className="h-4 w-4" />
                  PrestaShop source
                </a>
              </Button>
            </div>
          </Surface>
        </aside>

        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">
                    {clean(platform)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(connected ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-amber-100 bg-amber-50 text-amber-700")}
                  >
                    {connected ? "Connected" : "Setup in progress"}
                  </Badge>
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-[32px] md:leading-10">
                  Connect {selected?.domain || data.selectedSiteId}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Follow these steps after a customer gets access. The page checks the live bridge audit log and accepted events automatically.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium text-slate-500">Connection status</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{connected ? "Ready" : "Waiting"}</div>
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  Last accepted event: {timeAgo(lastAccepted)}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <Metric label="Bridge" value={data.bridge.ok ? "Online" : "Offline"} helper={data.bridge.health?.topic || data.bridge.error || "No bridge response"} icon={Radio} tone={data.bridge.ok ? "blue" : "red"} />
            <Metric label="Keys" value={`${selected?.public_key_count || 0}`} helper={`${selected?.server_key_count || 0} server secret key(s)`} icon={KeyRound} tone={hasKeys ? "emerald" : "amber"} />
            <Metric label="Events 24h" value={fmtInt(selected?.events_24h || 0)} helper={`Events 5m: ${fmtInt(selected?.events_5m || 0)}`} icon={Database} tone={hasEvents ? "emerald" : "amber"} />
            <Metric label="Rejected 1h" value={fmtInt(selected?.rejected_1h || 0)} helper={`Last rejected ${timeAgo(lastRejected)}`} icon={AlertTriangle} tone={hasRejections ? "red" : "emerald"} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Surface title="Installation Checklist" description="Customer-facing flow for installing and validating the tracker.">
              <div className="space-y-3">
                <StepRow index={1} title="Workspace created" description={`Website is registered with site_id ${data.selectedSiteId}.`} done={hasSite} />
                <StepRow index={2} title="Keys generated" description="Public write key exists for browser tracking. Server secret exists for private server-side events." done={hasKeys} />
                <StepRow index={3} title={`Install ${plugin.label}`} description={`Install the ${plugin.folder} plugin/module on the store.`} done={false} />
                <StepRow index={4} title="Paste tracker settings" description="Paste the site_id and public write key from the access package into the plugin settings." done={false} />
                <StepRow index={5} title="Open the storefront" description="Visit product/cart/checkout pages to generate a few test events." done={hasAccepted} warning={!hasAccepted && hasRejections} />
                <StepRow index={6} title="Connection verified" description="At least one authenticated event reached ClickHouse without recent key/origin errors." done={connected} warning={hasRejections} />
              </div>
            </Surface>

            <Surface title="Tracker Settings" description="Values the customer needs during plugin setup.">
              <div className="space-y-3">
                <CopyLine label="site_id" value={data.selectedSiteId} />
                <CopyLine label="webhook_url" value="https://tracker.yatootunisie.tn/webhook" />
                <CopyLine label="public_write_key" value="Shown once on the access page after /start" muted />
                <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                  Raw keys are not recoverable from the database because only hashes are stored. If a customer loses the key, rotate/generate a new key later.
                </div>
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                  Plugin settings location: {plugin.settingsPath}.
                </div>
              </div>
            </Surface>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Surface
              title="Open Source Plugin"
              description="Customers can inspect what the plugin tracks before installing."
              action={
                <Button asChild variant="outline" size="sm" className="border-slate-200 bg-white text-slate-700">
                  <a href={plugin.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Source
                  </a>
                </Button>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <Code2 className="h-5 w-5 text-blue-600" />
                  <div className="mt-2 text-sm font-semibold text-slate-950">Inspectable tracking code</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">The tracker implementation can be reviewed on GitHub by technical customers.</div>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <LockKeyhole className="h-5 w-5 text-emerald-600" />
                  <div className="mt-2 text-sm font-semibold text-slate-950">No hidden key storage</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">The SaaS stores key hashes; the raw server secret is not visible later.</div>
                </div>
              </div>
            </Surface>

            <Surface title="Troubleshooting" description="What to check when the connection is not green.">
              <div className="space-y-3">
                {[
                  ["401 Unauthorized", "The public write key is missing or wrong."],
                  ["403 Origin not allowed", "The website domain is not in allowed origins."],
                  ["No accepted events", "Clear website cache, open the storefront, and check browser Network tab."],
                  ["Wrong platform", "The plugin platform does not match the registered site platform."],
                ].map(([title, detail]) => (
                  <div key={title} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-slate-950">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
                  </div>
                ))}
              </div>
            </Surface>
          </section>

          <section className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/debug?site_id=${encodeURIComponent(data.selectedSiteId)}`}>
                <ShieldCheck className="h-4 w-4" />
                Open Debugger
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <Link href={`/?site_id=${encodeURIComponent(data.selectedSiteId)}`}>
                <Globe2 className="h-4 w-4" />
                Open Dashboard
              </Link>
            </Button>
            <Button variant="outline" className="border-slate-200 bg-white text-slate-700">
              <Download className="h-4 w-4" />
              Plugin downloads soon
            </Button>
          </section>
        </div>
      </main>
    </div>
  )
}
