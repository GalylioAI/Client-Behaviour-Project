import { ApiKeysPage } from "@/components/keys/api-keys-page"
import { requireSession } from "@/lib/auth"
import { loadApiKeyManagement } from "@/lib/site-keys"
import { resolveTenantSiteId } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"
export const revalidate = 0

type KeysPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function KeysPage({ searchParams }: KeysPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawSiteId = params.site_id
  const siteId = Array.isArray(rawSiteId) ? rawSiteId[0] : rawSiteId
  const session = await requireSession(siteId ? `/keys?site_id=${encodeURIComponent(siteId)}` : "/keys")
  const selectedSiteId = await resolveTenantSiteId(session.tenant_id, siteId)
  const data = await loadApiKeyManagement(selectedSiteId, session.tenant_id)
  return <ApiKeysPage data={data} />
}
