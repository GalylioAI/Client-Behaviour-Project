import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client"
import { requireSession } from "@/lib/auth"
import { loadInsights } from "@/lib/insights"
import { resolveTenantSiteId } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"
export const revalidate = 0

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawSiteId = params.site_id
  const siteId = Array.isArray(rawSiteId) ? rawSiteId[0] : rawSiteId
  const session = await requireSession(siteId ? `/?site_id=${encodeURIComponent(siteId)}` : "/")
  const selectedSiteId = await resolveTenantSiteId(session.tenant_id, siteId)
  const insights = await loadInsights(selectedSiteId)
  return <DashboardPageClient insights={insights} />
}
