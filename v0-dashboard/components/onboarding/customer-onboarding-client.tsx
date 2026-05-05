"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Globe2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  PlugZap,
  Radio,
  ShieldCheck,
  Store,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ProvisionedSite = {
  tenant_id: string
  site_id: string
  domain: string
  platform: string
  allowed_origins: string[]
  public_write_key: string
  server_secret_key: string
  note: string
  email_package?: {
    email_id: string
    to_email: string
    subject: string
    status: string
    provider: string
    connect_url: string
    dashboard_url: string
  } | null
  email_warning?: string
}

const platforms = [
  { value: "prestashop", label: "PrestaShop" },
  { value: "wordpress", label: "WordPress" },
]

function copy(value: string) {
  if (!value) return
  void navigator.clipboard?.writeText(value)
}

function Field({
  label,
  children,
  helper,
}: {
  label: string
  children: ReactNode
  helper?: string
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      {children}
      {helper ? <p className="text-xs leading-5 text-slate-500">{helper}</p> : null}
    </div>
  )
}

function CopyRow({
  label,
  value,
  secret = false,
}: {
  label: string
  value: string
  secret?: boolean
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <code className="block truncate text-xs font-medium text-slate-800">{value}</code>
      </div>
      {secret ? (
        <Badge variant="outline" className="hidden border-amber-100 bg-amber-50 text-amber-700 sm:inline-flex">
          private
        </Badge>
      ) : null}
      <Button type="button" variant="ghost" size="icon-sm" className="text-slate-500" onClick={() => copy(value)}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function CustomerOnboardingClient() {
  const [form, setForm] = useState({
    tenant_name: "",
    admin_email: "",
    password: "",
    confirm_password: "",
    domain: "",
    platform: "prestashop",
    site_id: "",
    allowed_origins: "",
  })
  const [status, setStatus] = useState<"idle" | "submitting" | "ready">("idle")
  const [error, setError] = useState("")
  const [site, setSite] = useState<ProvisionedSite | null>(null)

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("submitting")
    setError("")
    setSite(null)

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.")
      setStatus("idle")
      return
    }

    try {
      const response = await fetch("/api/sites/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          confirm_password: undefined,
          plan: "starter",
          timezone: "Africa/Tunis",
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Could not create your workspace.")
      }
      setSite(payload)
      setStatus("ready")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your workspace.")
      setStatus("idle")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">BehaviourAI</div>
              <div className="text-xs text-slate-500">Store behaviour intelligence</div>
            </div>
          </div>
          <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
            <Link href="/login">
              Log In
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1180px] gap-5 px-4 py-5 md:px-6 lg:grid-cols-[430px_minmax(0,1fr)]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">
                Starter access
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-500">
                Payment delayed
              </Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Create Your Workspace</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Register a store, generate tracker keys, and open the live dashboard.
            </p>
          </div>

          <form className="space-y-4 p-5" onSubmit={submit}>
            <Field label="Store or company name">
              <Input
                value={form.tenant_name}
                onChange={(event) => update("tenant_name", event.target.value)}
                placeholder="Parahouse"
                disabled={status === "submitting"}
              />
            </Field>

            <Field label="Owner email">
              <Input
                type="email"
                value={form.admin_email}
                onChange={(event) => update("admin_email", event.target.value)}
                placeholder="owner@example.tn"
                disabled={status === "submitting"}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password">
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => update("password", event.target.value)}
                  placeholder="At least 8 characters"
                  disabled={status === "submitting"}
                />
              </Field>
              <Field label="Confirm password">
                <Input
                  type="password"
                  value={form.confirm_password}
                  onChange={(event) => update("confirm_password", event.target.value)}
                  placeholder="Repeat password"
                  disabled={status === "submitting"}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Domain">
                <Input
                  value={form.domain}
                  onChange={(event) => update("domain", event.target.value)}
                  placeholder="example.tn"
                  disabled={status === "submitting"}
                />
              </Field>
              <Field label="Platform">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                  value={form.platform}
                  onChange={(event) => update("platform", event.target.value)}
                  disabled={status === "submitting"}
                >
                  {platforms.map((platform) => (
                    <option key={platform.value} value={platform.value}>
                      {platform.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Site ID" helper="Optional. Leave empty to generate one from the domain.">
              <Input
                value={form.site_id}
                onChange={(event) => update("site_id", event.target.value)}
                placeholder="example"
                disabled={status === "submitting"}
              />
            </Field>

            <Field label="Allowed origins" helper="Optional. One origin per line.">
              <Textarea
                className="min-h-20"
                value={form.allowed_origins}
                onChange={(event) => update("allowed_origins", event.target.value)}
                placeholder={"https://example.tn\nhttps://www.example.tn"}
                disabled={status === "submitting"}
              />
            </Field>

            {error ? (
              <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div>
            ) : null}

            <Button type="submit" disabled={status === "submitting"} className="w-full bg-blue-600 hover:bg-blue-700">
              {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              Create Access
            </Button>
          </form>
        </section>

        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: Store, label: "Workspace", value: site ? "Ready" : "Waiting", tone: site ? "text-emerald-600" : "text-slate-400" },
                { icon: KeyRound, label: "Tracker keys", value: site ? "Generated" : "Pending", tone: site ? "text-emerald-600" : "text-slate-400" },
                { icon: ShieldCheck, label: "Bridge auth", value: "Strict", tone: "text-blue-600" },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">{item.label}</span>
                    <item.icon className={cn("h-4 w-4", item.tone)} />
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-950">Access Package</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Keys are shown once after provisioning.</p>
            </div>
            <div className="p-5">
              {site ? (
                <div className="space-y-3">
                  <CopyRow label="Site ID" value={site.site_id} />
                  <CopyRow label="Public write key" value={site.public_write_key} />
                  <CopyRow label="Server secret key" value={site.server_secret_key} secret />
                  <CopyRow label="Webhook" value="https://tracker.yatootunisie.tn/webhook" />

                  <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                    Public key goes in plugin settings. Server secret stays private for server-side order events.
                  </div>

                  <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3">
                    <div className="flex items-start gap-3">
                      <Mail className="mt-0.5 h-4 w-4 text-emerald-700" />
                      <div>
                        <div className="text-sm font-semibold text-emerald-950">
                          {site.email_package ? "Onboarding email prepared" : "Email package not prepared"}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-emerald-800">
                          {site.email_package
                            ? `Prepared for ${site.email_package.to_email}. Preview it in the internal email outbox.`
                            : site.email_warning || "The workspace was created, but no email package was stored."}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="bg-blue-600 hover:bg-blue-700">
                      <Link href={`/connect?site_id=${encodeURIComponent(site.site_id)}`}>
                        Connect Plugin
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                      <Link href={`/app?site_id=${encodeURIComponent(site.site_id)}`}>
                        Open Dashboard
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                      <Link href="/emails">
                        Email Outbox
                      </Link>
                    </Button>
                    <Button type="button" variant="outline" className="border-slate-200 bg-white text-slate-700" onClick={() => window.location.reload()}>
                      Create Another Store
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-[300px] place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <div>
                    <LockKeyhole className="mx-auto h-10 w-10 text-slate-300" />
                    <div className="mt-3 text-sm font-semibold text-slate-800">Access is created automatically</div>
                    <div className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                      The same provisioning endpoint can later be called by a payment-success webhook.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Future Payment Flow</h2>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  {["Checkout paid", "Provision tenant", "Generate keys", "Send access email"].map((step, index) => (
                    <div key={step} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-2">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] font-semibold text-blue-700 ring-1 ring-slate-200">
                        {index + 1}
                      </span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
