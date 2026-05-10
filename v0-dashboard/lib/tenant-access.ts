import { redirect } from "next/navigation"

import { clickhouseQuery, num, sqlString, str } from "@/lib/clickhouse"

export interface TenantSiteAccess {
  site_id: string
  tenant_id: string
  domain: string
  platform: string
  status: string
}

export async function loadTenantSites(tenantId: string): Promise<TenantSiteAccess[]> {
  const rows = await clickhouseQuery(`
    SELECT
      site_id,
      tenant_id,
      argMax(domain, updated_at) AS domain,
      argMax(platform, updated_at) AS platform,
      argMax(status, updated_at) AS status,
      max(updated_at) AS latest_updated_at
    FROM tracer.sites
    WHERE tenant_id = ${sqlString(tenantId)}
    GROUP BY site_id, tenant_id
    HAVING status = 'active'
    ORDER BY latest_updated_at DESC
    LIMIT 100
  `)

  return rows.map((row) => ({
    site_id: str(row.site_id),
    tenant_id: str(row.tenant_id),
    domain: str(row.domain),
    platform: str(row.platform),
    status: str(row.status, "active"),
  }))
}

export async function resolveTenantSiteId(tenantId: string, requestedSiteId?: string, fallback = "/start") {
  const sites = await loadTenantSites(tenantId)
  if (!sites.length) {
    redirect(fallback)
  }

  if (requestedSiteId && sites.some((site) => site.site_id === requestedSiteId)) {
    return requestedSiteId
  }

  return sites[0].site_id
}

export async function canAccessSite(tenantId: string, siteId: string) {
  const rows = await clickhouseQuery<{ rows: number }>(`
    SELECT count() AS rows
    FROM tracer.sites
    WHERE tenant_id = ${sqlString(tenantId)}
      AND site_id = ${sqlString(siteId)}
      AND status = 'active'
  `)

  return num(rows[0]?.rows) > 0
}
