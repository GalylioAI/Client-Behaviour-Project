import { ConnectPage } from "@/components/connect/connect-page"
import { requireSession } from "@/lib/auth"
import { loadDebugData } from "@/lib/debug"
import { resolveTenantSiteId } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"
export const revalidate = 0

type ConnectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function TrackerConnectPage({ searchParams }: ConnectPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawSiteId = params.site_id
  const siteId = Array.isArray(rawSiteId) ? rawSiteId[0] : rawSiteId
  const session = await requireSession(siteId ? `/connect?site_id=${encodeURIComponent(siteId)}` : "/connect")
  const selectedSiteId = await resolveTenantSiteId(session.tenant_id, siteId)
  const data = await loadDebugData(selectedSiteId, session.tenant_id)

  return <ConnectPage data={data} />
}
