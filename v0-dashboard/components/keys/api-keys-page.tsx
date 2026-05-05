"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Github,
  Globe2,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ApiKeyManagementData, ManagedKeyType, ManagedSiteKey, RotatedKeyResult } from "@/lib/site-keys"
import { cn } from "@/lib/utils"

const WP_SOURCE_URL = "https://github.com/GalylioAI/Client-Behaviour-Project/tree/wp"
const PRESTA_SOURCE_URL = "https://github.com/GalylioAI/Client-Behaviour-Project/tree/Prestashop_module"
const WEBHOOK_URL = "https://tracker.yatootunisie.tn/webhook"

function copyText(value: string) {
  void navigator.clipboard?.writeText(value)
}

function cleanLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function timeAgo(value: string | null | undefined) {
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

function CopyLine({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <code className="block truncate text-xs font-medium text-slate-800">{secret ? value.replace(/^(.{16}).+(.{8})$/, "$1...$2") : value}</code>
      </div>
      <Button type="button" variant="ghost" size="icon-sm" className="text-slate-500" onClick={() => copyText(value)}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  )
}

function KeyBadge({ status }: { status: string }) {
  const active = status === "active"
  return (
    <Badge
      variant="outline"
      className={cn(
        active ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"
      )}
    >
      {active ? <CheckCircle2 className="h-3 w-3" /> : null}
      {cleanLabel(status || "unknown")}
    </Badge>
  )
}

function KeyRow({ row }: { row: ManagedSiteKey }) {
  return (
    <div className="grid gap-3 rounded-md border border-slate-100 bg-slate-50 p-3 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-900 ring-1 ring-slate-200">{row.key_prefix || "revoked key"}</code>
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
            {cleanLabel(row.key_type)}
          </Badge>
          <KeyBadge status={row.status} />
        </div>
        <div className="mt-2 text-xs leading-5 text-slate-500">
          Created {timeAgo(row.created_at)}{row.revoked_at ? ` · Revoked ${timeAgo(row.revoked_at)}` : ""}
        </div>
      </div>
      <div className="text-xs text-slate-500 md:text-right">
        <div className="font-medium text-slate-700">{row.key_id}</div>
        <div>Updated {timeAgo(row.updated_at)}</div>
      </div>
    </div>
  )
}

function SiteSwitcher({ data }: { data: ApiKeyManagementData }) {
  return (
    <Surface title="Websites" description="Choose which store keys you are managing." className="shadow-none">
      <div className="space-y-2">
        {data.sites.map((site) => (
          <Link
            key={site.site_id}
            href={`/keys?site_id=${encodeURIComponent(site.site_id)}`}
            className={cn(
              "block rounded-md border p-3 transition",
              site.site_id === data.selectedSiteId ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{site.domain || site.site_id}</div>
                <div className="truncate text-xs text-slate-500">{site.site_id} · {site.platform}</div>
              </div>
              <span className={cn("h-2 w-2 rounded-full", site.status === "active" ? "bg-emerald-500" : "bg-amber-500")} />
            </div>
          </Link>
        ))}
      </div>
    </Surface>
  )
}

export function ApiKeysPage({ data }: { data: ApiKeyManagementData }) {
  const [isRotating, setIsRotating] = useState<ManagedKeyType | null>(null)
  const [rotatedKey, setRotatedKey] = useState<RotatedKeyResult | null>(null)
  const [error, setError] = useState("")
  const site = data.sites.find((item) => item.site_id === data.selectedSiteId)
  const activePublic = useMemo(
    () => data.keys.filter((key) => key.key_type === "public_write" && key.status === "active" && !key.revoked_at),
    [data.keys]
  )
  const activeSecret = useMemo(
    () => data.keys.filter((key) => key.key_type === "server_secret" && key.status === "active" && !key.revoked_at),
    [data.keys]
  )

  async function rotate(type: ManagedKeyType) {
    setIsRotating(type)
    setError("")
    setRotatedKey(null)

    try {
      const response = await fetch("/api/site-keys/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: data.selectedSiteId, key_type: type }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Could not rotate key.")
      }

      setRotatedKey(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not rotate key.")
    } finally {
      setIsRotating(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">API Keys</div>
              <div className="text-xs text-slate-500">Rotate plugin keys and manage tracker access</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <Link href={`/connect?site_id=${encodeURIComponent(data.selectedSiteId)}`}>
                <Activity className="h-4 w-4" />
                Connect
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <Link href={`/downloads?site_id=${encodeURIComponent(data.selectedSiteId)}`}>
                <Download className="h-4 w-4" />
                Downloads
              </Link>
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/app?site_id=${encodeURIComponent(data.selectedSiteId)}`}>
                Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 md:px-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <SiteSwitcher data={data} />

          <Surface title="Trust Note" description="The tracker code is open source." className="shadow-none">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>Users can check the plugin code by themselves before installing it. This makes the SaaS feel safer because tracking behavior is visible.</p>
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
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">
                    {site?.platform || "site"}
                  </Badge>
                  <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700">
                    {site?.status || "active"}
                  </Badge>
                  <span className="text-xs text-slate-400">site_id: {data.selectedSiteId}</span>
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-[32px] md:leading-10">
                  Manage Tracker API Keys
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Rotate keys when a customer loses one, leaks one, changes developers, or needs a clean reinstall. The new raw key appears once, then only its hash remains in ClickHouse.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium text-slate-500">Public keys</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-950">{activePublic.length}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500">Server secrets</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-950">{activeSecret.length}</div>
                  </div>
                </div>
                <div className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
                  Last event: {timeAgo(data.stats.last_event_at)} · Accepted 24h: {data.stats.accepted_24h}
                </div>
              </div>
            </div>
          </section>

          {rotatedKey ? (
            <Surface
              title="New Key Generated"
              description="Copy it now. After leaving this page, the raw value cannot be recovered."
              className="border-emerald-200"
              action={
                <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-3 w-3" />
                  Shown once
                </Badge>
              }
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-3">
                  <CopyLine label={cleanLabel(rotatedKey.key_type)} value={rotatedKey.public_value} secret />
                  <CopyLine label="site_id" value={rotatedKey.site_id} />
                  <CopyLine label="webhook_url" value={WEBHOOK_URL} />
                </div>
                <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
                  Revoked {rotatedKey.revoked_key_ids.length} old key(s). Paste the new public key into the plugin settings, then open the storefront and check the connection wizard.
                  <div className="mt-2 text-xs">{rotatedKey.cache_note}</div>
                </div>
              </div>
            </Surface>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          ) : null}

          <section className="grid gap-5 xl:grid-cols-2">
            <Surface
              title="Public Write Key"
              description="Used by the WordPress/PrestaShop plugin and browser tracker."
              action={
                <Button onClick={() => rotate("public_write")} disabled={Boolean(isRotating)} className="bg-blue-600 hover:bg-blue-700">
                  {isRotating === "public_write" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Rotate
                </Button>
              }
            >
              <div className="space-y-3">
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                  This is the key customers paste into the plugin. Rotating it revokes the old public key and creates a new one.
                </div>
                {data.keys.filter((key) => key.key_type === "public_write").map((key) => (
                  <KeyRow key={key.key_id} row={key} />
                ))}
                {!data.keys.some((key) => key.key_type === "public_write") ? <p className="text-sm text-slate-500">No public key found.</p> : null}
              </div>
            </Surface>

            <Surface
              title="Server Secret Key"
              description="Reserved for private backend events such as paid orders."
              action={
                <Button onClick={() => rotate("server_secret")} disabled={Boolean(isRotating)} variant="outline" className="border-slate-200 bg-white text-slate-700">
                  {isRotating === "server_secret" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                  Rotate
                </Button>
              }
            >
              <div className="space-y-3">
                <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                  Do not put this key in frontend JavaScript. It is for future server-side integrations only.
                </div>
                {data.keys.filter((key) => key.key_type === "server_secret").map((key) => (
                  <KeyRow key={key.key_id} row={key} />
                ))}
                {!data.keys.some((key) => key.key_type === "server_secret") ? <p className="text-sm text-slate-500">No server secret found.</p> : null}
              </div>
            </Surface>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <KeyRound className="h-5 w-5 text-blue-600" />
              <div className="mt-3 text-sm font-semibold text-slate-950">1. Rotate</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">Generate a new key when the current one should no longer be trusted.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <Copy className="h-5 w-5 text-emerald-600" />
              <div className="mt-3 text-sm font-semibold text-slate-950">2. Copy Once</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">The raw key is not stored, so the customer must copy it while it is visible.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <Globe2 className="h-5 w-5 text-indigo-600" />
              <div className="mt-3 text-sm font-semibold text-slate-950">3. Verify</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">Open the store, send a test event, and use the connection wizard to confirm success.</p>
            </div>
          </section>

          <section className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/connect?site_id=${encodeURIComponent(data.selectedSiteId)}`}>
                <Activity className="h-4 w-4" />
                Verify Connection
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <a href={WP_SOURCE_URL} target="_blank" rel="noreferrer">
                WordPress source
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <a href={PRESTA_SOURCE_URL} target="_blank" rel="noreferrer">
                PrestaShop source
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </section>
        </div>
      </main>
    </div>
  )
}
