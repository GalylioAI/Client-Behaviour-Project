import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client"
import { requireSession } from "@/lib/auth"
import { loadInsights } from "@/lib/insights"
import { loadTenantSites, resolveTenantSiteId } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"
export const revalidate = 0

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawSiteId = params.site_id
  const rawView = params.view
  const siteId = Array.isArray(rawSiteId) ? rawSiteId[0] : rawSiteId
  const view = Array.isArray(rawView) ? rawView[0] : rawView
  const next = `/app${siteId ? `?site_id=${encodeURIComponent(siteId)}${view ? `&view=${encodeURIComponent(view)}` : ""}` : view ? `?view=${encodeURIComponent(view)}` : ""}`
  const session = await requireSession(next)
  const selectedSiteId = await resolveTenantSiteId(session.tenant_id, siteId)
  const sites = await loadTenantSites(session.tenant_id)
  const insights = await loadInsights(selectedSiteId)
  return <DashboardPageClient insights={insights} initialView={view} sites={sites} selectedSiteId={selectedSiteId} />
}
