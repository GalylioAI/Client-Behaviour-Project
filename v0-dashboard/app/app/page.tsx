import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client"
import { requireSession } from "@/lib/auth"
import { loadInsights } from "@/lib/insights"
import { loadTenantSites, resolveTenantSiteId } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"
export const revalidate = 0

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function parseLookbackDays(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw || process.env.DASHBOARD_LOOKBACK_DAYS || 7)
  if (!Number.isFinite(parsed) || parsed <= 0) return 7
  return Math.min(Math.max(Math.round(parsed), 1), 365)
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawSiteId = params.site_id
  const rawView = params.view
  const lookbackDays = parseLookbackDays(params.days)
  const siteId = Array.isArray(rawSiteId) ? rawSiteId[0] : rawSiteId
  const view = Array.isArray(rawView) ? rawView[0] : rawView
  const nextParams = new URLSearchParams()
  if (siteId) nextParams.set("site_id", siteId)
  if (view) nextParams.set("view", view)
  if (lookbackDays !== 7) nextParams.set("days", String(lookbackDays))
  const nextQuery = nextParams.toString()
  const next = `/app${nextQuery ? `?${nextQuery}` : ""}`
  const session = await requireSession(next)
  const selectedSiteId = await resolveTenantSiteId(session.tenant_id, siteId)
  const sites = await loadTenantSites(session.tenant_id)
  const insights = await loadInsights(selectedSiteId, { lookbackDays })
  return (
    <DashboardPageClient
      insights={insights}
      initialView={view}
      sites={sites}
      selectedSiteId={selectedSiteId}
      lookbackDays={lookbackDays}
      userEmail={session.email}
      userRole={session.role}
    />
  )
}
