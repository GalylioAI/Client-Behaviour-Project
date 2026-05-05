import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client"
import { loadInsights } from "@/lib/insights"

export const dynamic = "force-dynamic"
export const revalidate = 0

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawSiteId = params.site_id
  const siteId = Array.isArray(rawSiteId) ? rawSiteId[0] : rawSiteId
  const insights = await loadInsights(siteId)
  return <DashboardPageClient insights={insights} />
}
