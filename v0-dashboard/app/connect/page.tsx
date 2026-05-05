import { ConnectPage } from "@/components/connect/connect-page"
import { loadDebugData } from "@/lib/debug"

export const dynamic = "force-dynamic"
export const revalidate = 0

type ConnectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function TrackerConnectPage({ searchParams }: ConnectPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawSiteId = params.site_id
  const siteId = Array.isArray(rawSiteId) ? rawSiteId[0] : rawSiteId
  const data = await loadDebugData(siteId)

  return <ConnectPage data={data} />
}
