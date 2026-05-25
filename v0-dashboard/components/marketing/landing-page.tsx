"use client"

import Link from "next/link"
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Database,
  Github,
  KeyRound,
  LockKeyhole,
  Mail,
  PlugZap,
  Radio,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Radio,
    title: "Real-time behaviour tracking",
    body: "Capture product views, cart intent, checkout actions, referrers, device signals, and session movement from WordPress or PrestaShop.",
  },
  {
    icon: KeyRound,
    title: "Tenant-safe tracker keys",
    body: "Every website gets its own site_id, public write key, allowed origins, and rotation workflow.",
  },
  {
    icon: BarChart3,
    title: "Business-ready analytics",
    body: "Raw events become funnels, product engagement, referral insights, data quality checks, and business metrics.",
  },
  {
    icon: Bot,
    title: "AI-ready recommendations",
    body: "Start with deterministic recommendations now, then evolve into ML propensity, segmentation, and automated actions.",
  },
]

const workflow = [
  "Create workspace",
  "Install open-source plugin",
  "Verify live events",
  "Analyze behaviour",
  "Trigger smart actions",
]

const sceneEvents: Array<{ title: string; detail: string; icon: LucideIcon }> = [
  { title: "Key accepted", detail: "pk_live_example", icon: KeyRound },
  { title: "Product viewed", detail: "Air fryer", icon: Activity },
  { title: "AI opportunity", detail: "High intent", icon: Sparkles },
]

const trustItems: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: LockKeyhole, title: "Hashed keys", body: "Raw keys are shown once and stored as hashes." },
  { icon: PlugZap, title: "Origin checks", body: "Allowed origins protect each registered site." },
  { icon: Database, title: "Tenant-scoped data", body: "Dashboards and debug logs stay inside the tenant." },
  { icon: Workflow, title: "Recoverable infra", body: "Kafka, ClickHouse, and Airflow are separated by responsibility." },
]

const pricing = [
  {
    name: "Starter",
    price: "Free while in beta",
    description: "For first stores and validation.",
    items: ["1 website", "Real-time dashboard", "Plugin access", "Manual key rotation"],
    highlighted: false,
  },
  {
    name: "Growth",
    price: "Coming soon",
    description: "For stores ready to act on behaviour.",
    items: ["Multiple websites", "Automation rules", "Email/WhatsApp actions", "Exportable reports"],
    highlighted: true,
  },
  {
    name: "Intelligence",
    price: "Coming soon",
    description: "For advanced AI/ML analysis.",
    items: ["ML scoring", "Custom segments", "Model monitoring", "Dedicated pipelines"],
    highlighted: false,
  },
]

function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white shadow-sm", className)}>
      <Activity className="h-4 w-4" />
    </div>
  )
}

function FeatureCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  const { tr } = useI18n()

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-blue-700">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-950">{tr(title)}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{tr(body)}</p>
    </article>
  )
}

function HeroScene() {
  const { dir, tr } = useI18n()
  const isRtl = dir === "rtl"

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 z-0 hidden w-[56%] overflow-hidden lg:block",
        isRtl ? "left-0" : "right-0"
      )}
    >
      <div
        className={cn(
          "absolute top-20 h-[640px] w-[760px] rounded-lg border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]",
          isRtl ? "left-[-90px]" : "right-[-90px]"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
            {tr("Live dashboard")}
          </div>
        </div>

        <div className="grid h-[586px] grid-cols-[170px_minmax(0,1fr)]">
          <div className="border-r border-slate-100 bg-slate-50 p-4">
            <div className="mb-5 flex items-center gap-2">
              <BrandMark className="h-7 w-7" />
              <span className="text-xs font-semibold text-slate-950">BehaviourAI</span>
            </div>
            {["Dashboard", "Live Events", "Funnels", "API Keys", "Automations"].map((item, index) => (
              <div
                key={item}
                className={cn(
                  "mb-2 rounded-md px-3 py-2 text-xs font-medium",
                  index === 0 ? "bg-blue-50 text-blue-700" : "text-slate-500"
                )}
              >
                {tr(item)}
              </div>
            ))}
          </div>

          <div className="bg-[#f8fafc] p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500">{tr("Store overview")}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">website.com</div>
              </div>
              <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {tr("Receiving")}
              </Badge>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ["Sessions", "8,421", "text-blue-700"],
                ["Purchase rate", "3.42%", "text-teal-700"],
                ["Cart intent", "926", "text-amber-700"],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-xs font-medium text-slate-500">{tr(label)}</div>
                  <div className={cn("mt-2 text-xl font-semibold", tone)}>{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_220px] gap-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-950">{tr("Conversion funnel")}</div>
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    ["Sessions", "100%", "bg-blue-600"],
                    ["Products", "68%", "bg-teal-500"],
                    ["Cart", "31%", "bg-amber-500"],
                    ["Purchase", "9%", "bg-emerald-500"],
                  ].map(([label, width, color]) => (
                    <div key={label} className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-600">{tr(label)}</span>
                        <span className="font-semibold text-slate-950">{width}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className={cn("h-full rounded-full", color)} style={{ width }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {sceneEvents.map(({ title, detail, icon: Icon }) => (
                  <div key={title} className="rounded-lg border border-slate-200 bg-white p-3">
                    <Icon className="h-4 w-4 text-blue-600" />
                    <div className="mt-2 text-xs font-semibold text-slate-950">{tr(title)}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{tr(detail)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-blue-700" />
                <div>
                  <div className="text-sm font-semibold text-blue-950">{tr("Recommended action")}</div>
                  <p className="mt-1 text-xs leading-5 text-blue-900">
                    {tr("Create a cart recovery segment for visitors with repeated product intent.")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  const { t, tr, dir } = useI18n()
  const isRtl = dir === "rtl"

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <div>
              <div className="text-sm font-semibold text-slate-950">BehaviourAI</div>
              <div className="hidden text-xs text-slate-500 sm:block">{t("marketing.subtitle")}</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-950">{t("marketing.features")}</a>
            <a href="#workflow" className="hover:text-slate-950">{t("marketing.workflow")}</a>
            <a href="#pricing" className="hover:text-slate-950">{t("marketing.pricing")}</a>
            <a href="#trust" className="hover:text-slate-950">{t("marketing.trust")}</a>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Button asChild variant="outline" className="hidden border-slate-200 bg-white text-slate-700 sm:inline-flex">
              <Link href="/login">{t("common.login")}</Link>
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/start">
                {t("common.start")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#f6f9fc]">
          <HeroScene />
          <div className="relative z-10 mx-auto min-h-[88vh] max-w-[1180px] px-4 py-16 md:px-6 lg:py-24">
            <div className={cn("max-w-[560px]", isRtl && "ml-auto text-right")}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">
                  <Radio className="h-3 w-3" />
                  {t("marketing.heroBadge1")}
                </Badge>
                <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700">
                  {t("marketing.heroBadge2")}
                </Badge>
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[64px] lg:leading-[1.02]">
                BehaviourAI
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                {t("marketing.heroBody")}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/start">
                    {t("marketing.createWorkspace")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-slate-200 bg-white text-slate-700">
                  <Link href="/login">{t("common.login")}</Link>
                </Button>
              </div>

              <div className="mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
                {[
                  ["Kafka bridge", "validated events"],
                  ["ClickHouse", "analytics store"],
                  ["Airflow", "scheduled analysis"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-white/90 p-3">
                    <div className="text-xs font-medium text-slate-500">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-950">{tr(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-[1180px] px-4 md:px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{t("marketing.featuresTitle")}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {t("marketing.featuresBody")}
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-t border-slate-200 bg-slate-50 py-16">
          <div className="mx-auto grid max-w-[1180px] gap-8 px-4 md:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">{t("marketing.workflow")}</Badge>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{t("marketing.workflowTitle")}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {t("marketing.workflowBody")}
              </p>
            </div>

            <div className="grid gap-3">
              {workflow.map((item, index) => (
                <div key={item} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-sm font-semibold text-blue-700">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-slate-950">{tr(item)}</span>
                  {index < 3 ? <ArrowRight className="h-4 w-4 text-slate-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="trust" className="border-t border-slate-200 bg-white py-16">
          <div className="mx-auto grid max-w-[1180px] gap-8 px-4 md:px-6 lg:grid-cols-[1fr_1fr]">
            <div>
              <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-3 w-3" />
                {tr("Trust and transparency")}
              </Badge>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{t("marketing.trustTitle")}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {t("marketing.trustBody")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                  <a href="https://github.com/GalylioAI/Client-Behaviour-Project/tree/wp" target="_blank" rel="noreferrer">
                    <Github className="h-4 w-4" />
                    {tr("WordPress source")}
                  </a>
                </Button>
                <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                  <a href="https://github.com/GalylioAI/Client-Behaviour-Project/tree/Prestashop_module" target="_blank" rel="noreferrer">
                    <Github className="h-4 w-4" />
                    {tr("PrestaShop source")}
                  </a>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {trustItems.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Icon className="h-5 w-5 text-blue-600" />
                  <div className="mt-3 text-sm font-semibold text-slate-950">{tr(title)}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{tr(body)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t border-slate-200 bg-slate-50 py-16">
          <div className="mx-auto max-w-[1180px] px-4 md:px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{tr("Pricing that can grow with the product")}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {tr("Payment is delayed for now. The public pricing structure is ready so the product can later connect to checkout and automatic provisioning.")}
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {pricing.map((plan) => (
                <article
                  key={plan.name}
                  className={cn(
                    "rounded-lg border bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
                    plan.highlighted ? "border-blue-200 ring-2 ring-blue-100" : "border-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-950">{tr(plan.name)}</h3>
                    {plan.highlighted ? <Badge className="bg-blue-600 text-white hover:bg-blue-600">{tr("Recommended")}</Badge> : null}
                  </div>
                  <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{tr(plan.price)}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{tr(plan.description)}</p>
                  <div className="mt-5 space-y-3">
                    {plan.items.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {tr(item)}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white py-12">
          <div className="mx-auto flex max-w-[1180px] flex-col justify-between gap-5 px-4 md:flex-row md:items-center md:px-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">{t("marketing.readyTitle")}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{t("marketing.readyBody")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href="/start">
                  {t("marketing.startNow")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                <Link href="/login">{t("common.login")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
