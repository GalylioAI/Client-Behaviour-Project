import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client"
import { loadInsights } from "@/lib/insights"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function DashboardPage() {
  const insights = await loadInsights()
  return <DashboardPageClient insights={insights} />
}
