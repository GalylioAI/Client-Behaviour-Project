import { ApiKeysPage } from "@/components/keys/api-keys-page"
import { loadApiKeyManagement } from "@/lib/site-keys"

export const dynamic = "force-dynamic"
export const revalidate = 0

type KeysPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function KeysPage({ searchParams }: KeysPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawSiteId = params.site_id
  const siteId = Array.isArray(rawSiteId) ? rawSiteId[0] : rawSiteId
  const data = await loadApiKeyManagement(siteId)
  return <ApiKeysPage data={data} />
}
