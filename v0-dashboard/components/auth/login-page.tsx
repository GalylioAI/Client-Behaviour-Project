"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const previewEvents = [
  { label: "Product viewed", meta: "tdiscount.tn/product/air-fryer", tone: "bg-blue-500" },
  { label: "Cart intent detected", meta: "2 items · 148.00 TND", tone: "bg-teal-500" },
  { label: "Key accepted", meta: "pk_live_e80cfcfa", tone: "bg-emerald-500" },
]

const funnel = [
  { label: "Sessions", value: "8.4k", width: "100%", color: "bg-blue-600" },
  { label: "Product views", value: "5.1k", width: "72%", color: "bg-teal-500" },
  { label: "Cart actions", value: "926", width: "38%", color: "bg-amber-500" },
]

function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("grid h-10 w-10 place-items-center rounded-md bg-blue-600 text-white shadow-sm", className)}>
      <Activity className="h-5 w-5" />
    </div>
  )
}

function PreviewMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity
  label: string
  value: string
  tone: string
}) {
  return (
    <div className="rounded-md border border-white/60 bg-white/85 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className={cn("grid h-8 w-8 place-items-center rounded-md", tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-slate-500">Live</span>
      </div>
      <div className="mt-3 text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  )
}

export function LoginPage({ nextPath = "/" }: { nextPath?: string }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Could not log in.")
      }

      window.location.href = nextPath || "/"
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log in.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="grid min-h-screen lg:grid-cols-[minmax(0,0.86fr)_minmax(520px,1.14fr)]">
        <section className="flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between gap-4">
            <Link href="/login" className="flex items-center gap-3">
              <LogoMark className="h-9 w-9" />
              <div>
                <div className="text-sm font-semibold text-slate-950">BehaviourAI</div>
                <div className="text-xs text-slate-500">Tenant workspace</div>
              </div>
            </Link>
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <Link href="/start">
                Sign Up
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </header>

          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[420px]">
              <div className="mb-8">
                <LogoMark />
                <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">Welcome Back</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Log in to your behaviour intelligence workspace.
                </p>
              </div>

              <form className="space-y-5" onSubmit={submit}>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Email Address</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="owner@example.tn"
                    disabled={isSubmitting}
                    className="h-11 border-slate-200 bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    disabled={isSubmitting}
                    className="h-11 border-slate-200 bg-white"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 text-xs">
                  <label className="flex items-center gap-2 text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Remember me
                  </label>
                  <Link href="/start" className="font-medium text-blue-700 hover:text-blue-800">
                    Forgot password?
                  </Link>
                </div>

                {error ? <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div> : null}

                <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                  Login
                  {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
                </Button>
              </form>

              <p className="mt-6 text-xs leading-5 text-slate-500">
                By continuing, you agree to secure tenant access for your connected stores and analytics data.
              </p>

              <div className="mt-8 text-center text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <Link href="/start" className="font-semibold text-blue-700 hover:text-blue-800">
                  Sign Up
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="hidden min-h-screen bg-[#edf5ff] p-5 lg:block">
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-blue-100 bg-[linear-gradient(135deg,#f8fbff_0%,#dbeafe_42%,#e0f2fe_100%)] shadow-[0_20px_80px_rgba(23,105,232,0.16)]">
            <div className="flex items-center justify-between border-b border-white/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-white text-blue-700 shadow-sm">
                  <Radio className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-950">Live Operations</div>
                  <div className="text-xs text-slate-500">Real-time tenant overview</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Bridge online
              </div>
            </div>

            <div className="flex flex-1 items-center px-8 py-8">
              <div className="grid w-full gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-5">
                  <div className="rounded-lg border border-white/70 bg-white/80 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.10)] backdrop-blur">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-medium text-slate-500">Current store</div>
                        <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">tdiscount.tn</div>
                      </div>
                      <div className="rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        site_id: tdiscount
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <PreviewMetric icon={Activity} label="Events today" value="12.8k" tone="bg-blue-50 text-blue-700" />
                      <PreviewMetric icon={BarChart3} label="Purchase rate" value="3.42%" tone="bg-teal-50 text-teal-700" />
                      <PreviewMetric icon={KeyRound} label="Active keys" value="2" tone="bg-amber-50 text-amber-700" />
                    </div>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-lg border border-white/70 bg-white/75 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-950">Conversion Funnel</div>
                        <Sparkles className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="mt-5 space-y-4">
                        {funnel.map((item) => (
                          <div key={item.label} className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-600">{item.label}</span>
                              <span className="font-semibold text-slate-950">{item.value}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100">
                              <div className={cn("h-full rounded-full", item.color)} style={{ width: item.width }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/70 bg-white/75 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-950">Tenant Guard</div>
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="mt-5 space-y-3">
                        {["Protected dashboard", "Scoped API keys", "Private debug logs"].map((item) => (
                          <div key={item} className="flex items-center gap-2 text-sm text-slate-700">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="rounded-lg border border-white/70 bg-white/75 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.10)] backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">Live Event Feed</div>
                      <div className="mt-1 text-xs text-slate-500">Last few seconds</div>
                    </div>
                    <Activity className="h-4 w-4 text-blue-600" />
                  </div>

                  <div className="mt-5 space-y-3">
                    {previewEvents.map((event) => (
                      <div key={event.label} className="grid grid-cols-[auto_1fr] gap-3 rounded-md border border-slate-100 bg-white/80 p-3">
                        <span className={cn("mt-1 h-2 w-2 rounded-full", event.tone)} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-950">{event.label}</div>
                          <div className="mt-1 truncate text-xs text-slate-500">{event.meta}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">AI Opportunity</div>
                    <p className="mt-2 text-sm leading-6 text-blue-950">
                      High product intent detected on repeat visitors.
                    </p>
                  </div>
                </aside>
              </div>
            </div>

            <div className="border-t border-white/70 px-8 py-5">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Real-time behaviour intelligence</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Secure tenant access for dashboards, tracker keys, live events, and the automation layer coming next.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
