import { DownloadsPage } from "@/components/downloads/downloads-page"

export const dynamic = "force-dynamic"
export const revalidate = 0

type DownloadsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function PluginDownloadsPage({ searchParams }: DownloadsPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawSiteId = params.site_id
  const siteId = Array.isArray(rawSiteId) ? rawSiteId[0] : rawSiteId

  return <DownloadsPage siteId={siteId} />
}
