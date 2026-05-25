"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Activity,
  ArrowRight,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gauge,
  Globe2,
  Info,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LineChart as LineChartIcon,
  LogOut,
  Mail,
  Package,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Workflow,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useI18n } from "@/lib/i18n"
import type { PreparedOnboardingEmail } from "@/lib/onboarding-email"
import type { PreparedRecommendationEmail } from "@/lib/recommendation-email"
import type { TenantSiteAccess } from "@/lib/tenant-access"
import { cn } from "@/lib/utils"

type EmailStatusFilter = "all" | "prepared" | "sent"
type EmailKind = "recommendation" | "onboarding"
type SelectedEmail =
  | { kind: "recommendation"; email: PreparedRecommendationEmail }
  | { kind: "onboarding"; email: PreparedOnboardingEmail }

const EMAIL_SIDEBAR_STORAGE_KEY = "behaviourai_email_sidebar_open"

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

function absoluteDate(value: string | null) {
  if (!value) return "Not available"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function Surface({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const prepared = status === "prepared"
  const sent = status === "sent"
  return (
    <Badge
      variant="outline"
      className={cn(
        prepared && "border-blue-100 bg-blue-50 text-blue-700",
        sent && "border-emerald-100 bg-emerald-50 text-emerald-700",
        !prepared && !sent && "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      {prepared ? <Inbox className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
      {prepared ? "Will be sent" : sent ? "Sent" : status}
    </Badge>
  )
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: string | number
  helper: string
  icon: typeof Inbox
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div>
    </div>
  )
}

function normalize(value: string) {
  return value.toLowerCase().trim()
}

function matchesSearch(email: PreparedRecommendationEmail, query: string) {
  if (!query) return true
  const haystack = [
    email.to_email,
    email.site_id,
    email.subject,
    email.preview_text,
    email.status,
    email.provider,
    email.product_ids.join(" "),
  ].join(" ").toLowerCase()
  return haystack.includes(query)
}

function siteDisplayName(site?: TenantSiteAccess) {
  return site?.domain || site?.site_id || "Website"
}

function platformDisplayName(platform?: string) {
  if (platform === "wordpress") return "WordPress"
  if (platform === "prestashop") return "PrestaShop"
  return platform || "Website"
}

function appHref(siteId: string, view: string) {
  return siteId ? `/app?site_id=${encodeURIComponent(siteId)}&view=${encodeURIComponent(view)}` : `/app?view=${encodeURIComponent(view)}`
}

function EmailSidebar({
  sites,
  selectedSiteId,
  selectedSite,
  isCollapsed,
  onToggle,
}: {
  sites: TenantSiteAccess[]
  selectedSiteId: string
  selectedSite?: TenantSiteAccess
  isCollapsed: boolean
  onToggle: () => void
}) {
  const { t, tr } = useI18n()
  const siteId = selectedSiteId || sites[0]?.site_id || ""
  const siteQuery = siteId ? `?site_id=${encodeURIComponent(siteId)}` : ""
  const navSections = [
    [
      { label: "Dashboard", icon: LayoutDashboard, href: appHref(siteId, "overview") },
      { label: "Live Events", icon: Activity, href: appHref(siteId, "live") },
      { label: "Funnels", icon: BarChart3, href: appHref(siteId, "funnels") },
      { label: "Traffic", icon: Users, href: appHref(siteId, "audience") },
      { label: "Products", icon: PackageSearch, href: appHref(siteId, "products") },
      { label: "Reports", icon: LineChartIcon, href: appHref(siteId, "reports") },
      { label: "Sites", icon: Globe2, href: appHref(siteId, "sites") },
    ],
    [
      { label: "Smart Actions", icon: Sparkles, href: appHref(siteId, "smart-actions") },
      { label: "Purchase Intent", icon: Gauge, href: appHref(siteId, "smart-intent") },
      { label: "Recommendations", icon: Send, href: appHref(siteId, "smart-recommendations") },
      { label: "Email Outbox", icon: Mail, href: `/emails${siteQuery}`, active: true },
    ],
    [
      { label: "API Keys", icon: KeyRound, href: `/keys${siteQuery}` },
      { label: "Pipelines", icon: Workflow, href: appHref(siteId, "pipelines") },
      { label: "Settings", icon: Settings, href: appHref(siteId, "settings") },
    ],
  ]

  return (
    <aside className="hidden h-screen min-w-0 overflow-hidden border-r border-slate-200 bg-white transition-all duration-300 ease-out lg:sticky lg:top-0 lg:flex lg:flex-col">
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
            href={appHref(siteId, "sites")}
            title={siteDisplayName(selectedSite)}
            className="mx-auto grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <Globe2 className="h-4 w-4" />
          </Link>
        ) : (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="truncate text-xs font-semibold text-slate-900">{siteDisplayName(selectedSite)}</div>
            <div className="truncate text-xs text-slate-500">{platformDisplayName(selectedSite?.platform)} · {siteId || "no site_id"}</div>
            {sites.length > 1 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {sites.slice(0, 4).map((site) => (
                  <Link
                    key={site.site_id}
                    href={`/emails?site_id=${encodeURIComponent(site.site_id)}`}
                    className={cn(
                      "rounded border px-1.5 py-1 text-[10px] font-medium",
                      site.site_id === siteId
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {site.site_id}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-3 px-3 py-3">
        {navSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className={cn(sectionIndex > 0 && "border-t border-slate-100 pt-3")}>
            {section.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  title={tr(item.label)}
                  aria-label={tr(item.label)}
                  className={cn(
                    "mb-1 flex h-9 w-full items-center rounded-md text-sm font-medium transition-colors",
                    isCollapsed ? "justify-center px-0" : "gap-3 px-3",
                    item.active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn("truncate transition-opacity duration-200", isCollapsed && "sr-only")}>{tr(item.label)}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className={cn("space-y-2 border-t border-slate-100 transition-all duration-300", isCollapsed ? "p-3" : "p-4")}>
        <Link
          href="/setup"
          title={t("nav.addWebsite")}
          className={cn(
            "flex h-9 w-full items-center rounded-md text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950",
            isCollapsed ? "justify-center px-0" : "gap-3 px-3"
          )}
        >
          <Plus className="h-4 w-4" />
          <span className={cn("truncate", isCollapsed && "sr-only")}>{t("nav.addWebsite")}</span>
        </Link>
        <button
          type="button"
          onClick={onToggle}
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

export function EmailsPage({
  emails,
  recommendationEmails,
  sites,
  selectedSiteId,
  dataError,
}: {
  emails: PreparedOnboardingEmail[]
  recommendationEmails: PreparedRecommendationEmail[]
  sites: TenantSiteAccess[]
  selectedSiteId: string
  dataError?: string
}) {
  const { t, tr } = useI18n()
  const [statusFilter, setStatusFilter] = useState<EmailStatusFilter>("all")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState(recommendationEmails[0]?.email_id || emails[0]?.email_id || "")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const selectedSite = sites.find((site) => site.site_id === selectedSiteId)

  const query = normalize(search)
  const filteredRecommendations = useMemo(() => {
    return recommendationEmails.filter((email) => {
      const statusMatches = statusFilter === "all" || email.status === statusFilter
      return statusMatches && matchesSearch(email, query)
    })
  }, [recommendationEmails, query, statusFilter])

  const selected: SelectedEmail | undefined = useMemo(() => {
    const recommendation = recommendationEmails.find((email) => email.email_id === selectedId)
    if (recommendation) return { kind: "recommendation" as const, email: recommendation }
    const onboarding = emails.find((email) => email.email_id === selectedId)
    if (onboarding) return { kind: "onboarding" as const, email: onboarding }
    if (filteredRecommendations[0]) return { kind: "recommendation" as const, email: filteredRecommendations[0] }
    if (emails[0]) return { kind: "onboarding" as const, email: emails[0] }
    return undefined
  }, [emails, filteredRecommendations, recommendationEmails, selectedId])

  const preparedRecommendations = recommendationEmails.filter((email) => email.status === "prepared").length
  const sentRecommendations = recommendationEmails.filter((email) => email.status === "sent").length
  const uniqueRecipients = new Set(recommendationEmails.map((email) => email.to_email).filter(Boolean)).size
  const latestRecommendation = recommendationEmails[0]

  const selectedBodyText = selected?.email.body_text || ""
  const selectedRecipient = selected?.email.to_email || ""
  const selectedSubject = selected?.email.subject || ""
  const selectedStatus = selected?.email.status || ""
  const selectedUpdatedAt = selected?.email.updated_at || selected?.email.created_at || ""
  const selectedKind: EmailKind | undefined = selected?.kind

  useEffect(() => {
    const saved = window.localStorage.getItem(EMAIL_SIDEBAR_STORAGE_KEY)
    if (saved === "false") {
      setIsSidebarOpen(false)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(EMAIL_SIDEBAR_STORAGE_KEY, String(isSidebarOpen))
  }, [isSidebarOpen])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div
        className={cn(
          "grid min-h-screen transition-[grid-template-columns] duration-300 ease-out",
          isSidebarOpen ? "lg:grid-cols-[240px_minmax(0,1fr)]" : "lg:grid-cols-[72px_minmax(0,1fr)]"
        )}
      >
        <EmailSidebar
          sites={sites}
          selectedSiteId={selectedSiteId}
          selectedSite={selectedSite}
          isCollapsed={!isSidebarOpen}
          onToggle={() => setIsSidebarOpen((value) => !value)}
        />

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="hidden text-slate-500 hover:bg-slate-100 hover:text-slate-950 lg:inline-flex"
                  onClick={() => setIsSidebarOpen((value) => !value)}
                  aria-label={isSidebarOpen ? t("nav.collapseSidebar") : t("nav.expandSidebar")}
                  title={isSidebarOpen ? t("nav.collapseSidebar") : t("nav.expandSidebar")}
                >
                  {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                </Button>
                <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{tr("Recommendation Outbox")}</div>
                  <div className="truncate text-xs text-slate-500">
                    {selectedSite?.domain || selectedSiteId} · {tr("customer recommendation emails for this site only")}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <LanguageSwitcher compact />
                <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                  <Link href={`/app?site_id=${encodeURIComponent(selectedSiteId)}&view=smart-recommendations`}>
                    <Radio className="h-4 w-4" />
                    {tr("Smart Actions")}
                  </Link>
                </Button>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href={`/app?site_id=${encodeURIComponent(selectedSiteId)}`}>
                    {t("common.dashboard")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" className="text-slate-500" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

      <main className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 md:px-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-5">
          {dataError ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">{tr("Outbox temporarily unavailable")}</div>
                  <p className="mt-1 leading-6">{dataError}</p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{tr("Website")}</div>
            <div className="flex flex-wrap gap-2">
              {sites.map((site) => (
                <Link
                  key={site.site_id}
                  href={`/emails?site_id=${encodeURIComponent(site.site_id)}`}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm transition",
                    site.site_id === selectedSiteId
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <span className="font-medium">{site.domain || site.site_id}</span>
                  <span className="ml-2 text-xs opacity-70">{site.platform}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <StatCard label={tr("Will be sent")} value={preparedRecommendations} helper={tr("Prepared drafts awaiting real sending rules")} icon={CalendarClock} />
            <StatCard label={tr("Sent")} value={sentRecommendations} helper={tr("Delivered through a provider when enabled")} icon={CheckCircle2} />
            <StatCard label={tr("Recipients")} value={uniqueRecipients} helper={tr("Unique customers with recommendation emails")} icon={User} />
            <StatCard label={tr("Latest run")} value={timeAgo(latestRecommendation?.generated_at || null)} helper={tr("Last recommendation outbox refresh")} icon={Clock3} />
          </section>

          <Surface
            title={tr("Customer Recommendation Emails")}
            description={tr("This is the operational queue for recommendation outreach. Prepared emails are the ones that will be sent later once provider, consent, cooldown, and approval rules are enabled.")}
            action={<StatusBadge status="prepared" />}
          >
            <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={tr("Search recipient, subject, site, product id...")}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as EmailStatusFilter)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              >
                <option value="all">{tr("All statuses")}</option>
                <option value="prepared">{tr("Will be sent")}</option>
                <option value="sent">{tr("Sent")}</option>
              </select>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[1.3fr_0.9fr_0.5fr_0.7fr_0.7fr] border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 max-lg:hidden">
                <div>{tr("Recipient")}</div>
                <div>{tr("Subject")}</div>
                <div>{tr("Products")}</div>
                <div>{tr("Status")}</div>
                <div>{tr("Updated")}</div>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredRecommendations.map((email) => (
                  <button
                    key={email.email_id}
                    type="button"
                    onClick={() => setSelectedId(email.email_id)}
                    className={cn(
                      "grid w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 lg:grid-cols-[1.3fr_0.9fr_0.5fr_0.7fr_0.7fr] lg:items-center",
                      selected?.kind === "recommendation" && selected.email.email_id === email.email_id && "bg-blue-50/60"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-950">{email.to_email}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{email.site_id}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{email.provider}</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{email.subject}</div>
                      <div className="mt-1 line-clamp-1 text-xs text-slate-500">{email.preview_text}</div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Package className="h-4 w-4 text-slate-400" />
                      {email.product_count}
                    </div>
                    <StatusBadge status={email.status} />
                    <div className="text-xs text-slate-500">
                      <div>{timeAgo(email.updated_at)}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{absoluteDate(email.updated_at)}</div>
                    </div>
                  </button>
                ))}
                {!filteredRecommendations.length ? (
                  <div className="px-4 py-12 text-center text-sm text-slate-500">
                    {tr("No recommendation emails match these filters.")}
                  </div>
                ) : null}
              </div>
            </div>
          </Surface>

          <Surface title={tr("Onboarding Email History")} description={tr("Setup messages created when a new website is provisioned.")}>
            <div className="grid gap-3 md:grid-cols-2">
              {emails.slice(0, 6).map((email) => (
                <button
                  key={email.email_id}
                  type="button"
                  onClick={() => setSelectedId(email.email_id)}
                  className={cn(
                    "rounded-md border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50",
                    selected?.kind === "onboarding" && selected.email.email_id === email.email_id && "border-blue-200 bg-blue-50"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-medium text-slate-950">{email.to_email}</div>
                    <StatusBadge status={email.status} />
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">{email.site_id} · {email.preview_text}</div>
                </button>
              ))}
              {!emails.length ? <p className="text-sm text-slate-500">{tr("No onboarding emails prepared yet.")}</p> : null}
            </div>
          </Surface>
        </div>

        <aside className="space-y-5">
          <Surface
            title={tr("Selected Email")}
            description={selectedKind === "recommendation" ? tr("Preview the exact customer recommendation draft.") : tr("Preview the setup email.")}
            action={selectedStatus ? <StatusBadge status={selectedStatus} /> : null}
          >
            {selected ? (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tr("To")}</div>
                    <div className="mt-1 truncate font-medium text-slate-950">{selectedRecipient}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tr("Subject")}</div>
                    <div className="mt-1 font-medium text-slate-950">{selectedSubject}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tr("Updated")}</div>
                      <div className="mt-1 text-slate-700">{absoluteDate(selectedUpdatedAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tr("Provider")}</div>
                      <div className="mt-1 text-slate-700">{selected.email.provider}</div>
                    </div>
                  </div>
                </div>

                {selected.kind === "recommendation" ? (
                  <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                    <TooltipProvider delayDuration={1000}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex cursor-help items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800 outline-none transition hover:text-blue-950 focus-visible:ring-2 focus-visible:ring-blue-300"
                          >
                            {tr("Recommendation payload")}
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={8} className="max-w-[260px] bg-slate-950 px-3 py-2 text-left text-xs leading-5 text-white">
                          {tr("The products attached to this email. The system uses these product IDs to know what to recommend, build the email content, and later measure which recommendation led to a click or sale.")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selected.email.product_ids.map((productId) => (
                        <Badge key={productId} variant="outline" className="border-blue-100 bg-white text-blue-700">
                          {productId}
                        </Badge>
                      ))}
                      {!selected.email.product_ids.length ? <span className="text-xs text-blue-800">{tr("No product ids attached.")}</span> : null}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">{selectedBodyText}</pre>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selected.kind === "onboarding" ? (
                    <>
                      <Button asChild className="bg-blue-600 hover:bg-blue-700">
                        <Link href={selected.email.connect_url}>
                          {tr("Open Connect")}
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                        <Link href={selected.email.dashboard_url}>{t("common.dashboard")}</Link>
                      </Button>
                    </>
                  ) : (
                    <Button asChild className="bg-blue-600 hover:bg-blue-700">
                      <Link href={`/app?site_id=${encodeURIComponent(selected.email.site_id)}&view=smart-recommendations`}>
                        {tr("Open Recommendation Engine")}
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                {tr("No email selected.")}
              </div>
            )}
          </Surface>

          <Surface title={tr("Sending Guardrails")} description={tr("What keeps this safe before real automation.")}>
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="font-medium text-slate-950">{tr("Prepared means planned")}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{tr("These emails are the next candidates to send, but they remain drafts until the SMTP provider and consent rules are enabled.")}</p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="font-medium text-slate-950">{tr("Sent stays auditable")}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{tr("When sending is connected, sent emails will stay in this same outbox with status, provider, and sent time.")}</p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="font-medium text-slate-950">{tr("Customer pressure is controlled")}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{tr("Automation intensity decides who enters the queue. Cooldown and weekly caps will prevent over-contacting customers.")}</p>
              </div>
            </div>
          </Surface>

          <Surface title={tr("Setup Emails")} description={tr("Kept here for support and onboarding traceability.")}>
            <div className="text-sm leading-6 text-slate-600">
              {tr("Onboarding emails are separate from customer recommendation outreach. They help the store owner install the tracker, while recommendation emails are for store customers.")}
            </div>
          </Surface>
        </aside>
          </main>
        </div>
      </div>
    </div>
  )
}
