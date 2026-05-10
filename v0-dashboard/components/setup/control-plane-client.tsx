"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe2,
  KeyRound,
  Loader2,
  PlugZap,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ControlPlaneData } from "@/lib/control-plane"
import { cn } from "@/lib/utils"

type RegistrationResult = {
  tenant_id: string
  site_id: string
  domain: string
  platform: string
  allowed_origins: string[]
  public_write_key: string
  server_secret_key: string
  note: string
}

const platformOptions = [
  { label: "WordPress", value: "wordpress" },
  { label: "PrestaShop", value: "prestashop" },
]

function timeAgo(value: string | null) {
  if (!value) return "No events yet"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

async function copyText(value: string) {
  if (!value) return

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value)
      return
    }
  } catch {
    // Fall back below for non-HTTPS VM access.
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  textarea.style.top = "0"
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, value.length)
  document.execCommand("copy")
  document.body.removeChild(textarea)
}

function SetupSurface({
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

function Field({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      {children}
      {helper ? <p className="text-xs leading-5 text-slate-500">{helper}</p> : null}
    </div>
  )
}

function CodeLine({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <code className="block whitespace-pre-wrap break-all text-xs font-medium leading-5 text-slate-800">{value}</code>
      </div>
      <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 text-slate-500" onClick={() => copyText(value)} aria-label={`Copy ${label}`}>
        <Copy className="h-4 w-4" />
      </Button>
      {secret ? (
        <Badge variant="outline" className="mt-0.5 hidden border-amber-100 bg-amber-50 text-amber-700 sm:inline-flex">
          private
        </Badge>
      ) : null}
    </div>
  )
}

export function ControlPlaneClient({ data }: { data: ControlPlaneData }) {
  const currentTenant = data.tenants[0]
  const [form, setForm] = useState({
    tenant_name: currentTenant?.name || "",
    admin_email: currentTenant?.contact_email || "",
    domain: "",
    platform: "prestashop",
    site_id: "",
    tenant_id: currentTenant?.tenant_id || "",
    allowed_origins: "",
    timezone: "Africa/Tunis",
    plan: "starter",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<RegistrationResult | null>(null)

  const totals = useMemo(
    () => ({
      tenants: data.tenants.length,
      sites: data.sites.length,
      activeSites: data.sites.filter((site) => site.status === "active").length,
      liveSites: data.sites.filter((site) => site.latest_event).length,
    }),
    [data]
  )

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError("")
    setResult(null)

    try {
      const response = await fetch("/api/sites/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Could not register the site.")
      }
      setResult(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register the site.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white">
              <PlugZap className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">BehaviourAI Control Plane</div>
              <div className="text-xs text-slate-500">Tenant setup, tracker keys, and connection checks</div>
            </div>
          </div>
          <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
            <Link href="/app">
              <ExternalLink className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 md:px-6">
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Tenants</span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{totals.tenants}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Websites</span>
              <Globe2 className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{totals.sites}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Active sites</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{totals.activeSites}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Receiving events</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{totals.liveSites}</div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
          <SetupSurface title="Add Website To This Account" description="Register another WordPress or PrestaShop site under the current workspace, generate tracker keys, and lock allowed origins.">
            <form className="space-y-4" onSubmit={submit}>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Current account</div>
                <div className="mt-1 text-sm font-semibold text-blue-950">{currentTenant?.name || "Your workspace"}</div>
                <div className="mt-0.5 truncate text-xs text-blue-700">
                  {currentTenant?.contact_email || form.admin_email || "Logged-in tenant"} · {currentTenant?.tenant_id || form.tenant_id || "tenant"}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Website domain">
                  <Input value={form.domain} onChange={(event) => updateField("domain", event.target.value)} placeholder="example.tn" />
                </Field>
                <Field label="Platform">
                  <select
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={form.platform}
                    onChange={(event) => updateField("platform", event.target.value)}
                  >
                    {platformOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Site ID" helper="Optional. Leave empty to generate one from the domain.">
                  <Input value={form.site_id} onChange={(event) => updateField("site_id", event.target.value)} placeholder="parahouse" />
                </Field>
                <Field label="Plan">
                  <select
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={form.plan}
                    onChange={(event) => updateField("plan", event.target.value)}
                  >
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="business">Business</option>
                  </select>
                </Field>
              </div>
              <Field label="Allowed origins" helper="One per line. Leave empty for https://domain and https://www.domain.">
                <Textarea
                  value={form.allowed_origins}
                  onChange={(event) => updateField("allowed_origins", event.target.value)}
                  placeholder={"https://example.tn\nhttps://www.example.tn"}
                  className="min-h-20"
                />
              </Field>
              {error ? (
                <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <span>{error}</span>
                </div>
              ) : null}
              <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Add Website And Generate Keys
              </Button>
            </form>
          </SetupSurface>

          <div className="space-y-5">
            <SetupSurface title="Generated Tracker Configuration" description="Copy these values into the plugin. The secret key is shown once and should stay server-side.">
              {result ? (
                <div className="space-y-3">
                  <CodeLine label="site_id" value={result.site_id} />
                  <CodeLine label="platform" value={result.platform} />
                  <CodeLine label="public write key" value={result.public_write_key} />
                  <CodeLine label="server secret key" value={result.server_secret_key} secret />
                  <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                    Browser events use the public key. Server-side purchase/order events can use the server secret. Never expose the secret in custom frontend JavaScript.
                  </div>
                  <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                    <Link href={`/app?site_id=${encodeURIComponent(result.site_id)}`}>
                      <ExternalLink className="h-4 w-4" />
                      Open Site Dashboard
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-200 p-8 text-center">
                  <KeyRound className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">No new keys generated in this session.</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Existing raw keys cannot be recovered because only hashes are stored.</p>
                </div>
              )}
            </SetupSurface>

            <SetupSurface title="Plugin Install Checklist" description="Use this after creating the site record.">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  "Install the latest tracker plugin.",
                  "Paste site_id and public write key.",
                  "Keep server secret in config only.",
                  "Clear website/plugin cache.",
                  "Open the website and generate events.",
                  "Check bridge logs and dashboard freshness.",
                ].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                    <div className="grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-semibold text-blue-700 ring-1 ring-slate-200">
                      {index + 1}
                    </div>
                    <span className="text-sm text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </SetupSurface>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <SetupSurface title="Registered Websites" description="This is your current multi-tenant registry. A site becomes live when events arrive with a valid key.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="py-3 pr-4">Website</th>
                    <th className="py-3 pr-4">Tenant</th>
                    <th className="py-3 pr-4">Keys</th>
                    <th className="py-3 pr-4">Events</th>
                    <th className="py-3 pr-4">Freshness</th>
                    <th className="py-3 pr-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sites.map((site) => (
                    <tr key={`${site.tenant_id}-${site.site_id}`} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-950">{site.domain || site.site_id}</div>
                        <div className="text-xs text-slate-500">{site.site_id} · {site.platform}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{site.tenant_id || "unknown"}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                          {site.public_key_count} public / {site.server_key_count} secret
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 font-semibold tabular-nums text-slate-950">{site.raw_events_7d.toLocaleString()}</td>
                      <td className="py-3 pr-4">
                        <span className={cn("text-xs font-medium", site.latest_event ? "text-emerald-700" : "text-amber-700")}>
                          {timeAgo(site.latest_event)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <Button asChild size="sm" variant="outline" className="border-slate-200 bg-white text-slate-700">
                          <Link href={`/app?site_id=${encodeURIComponent(site.site_id)}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!data.sites.length ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                        No registered sites yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SetupSurface>

          <SetupSurface title="Live Operations Commands" description="Use these while testing trackers on real websites.">
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                <div className="mb-2 flex items-center gap-2 text-slate-400">
                  <Terminal className="h-4 w-4" />
                  Bridge logs
                </div>
                <code>ssh -i /home/iyed/.ssh/pfe_codex pc1@ssh.yatootunisie.tn "cd /home/pc1/kafka-cluster && docker compose logs -f --tail=100 bridge"</code>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                <div className="mb-2 flex items-center gap-2 text-slate-400">
                  <Terminal className="h-4 w-4" />
                  Latest accepted events
                </div>
                <code>watch -n 2 'docker exec clickhouse clickhouse-client -u admin --password changeme -d tracer -q "SELECT received_at, site_id, platform, event_name FROM ecommerce_events ORDER BY received_at DESC LIMIT 15 FORMAT PrettyCompact"'</code>
              </div>
            </div>
          </SetupSurface>
        </section>
      </main>
    </div>
  )
}
