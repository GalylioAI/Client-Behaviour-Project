import { clickhouseCommand, clickhouseQuery, num, str } from "@/lib/clickhouse"

export interface TenantRecord {
  tenant_id: string
  name: string
  contact_email: string
  plan: string
  status: string
  created_at: string
  updated_at: string
}

export interface SiteRecord {
  site_id: string
  tenant_id: string
  domain: string
  platform: string
  allowed_origins: string[]
  timezone: string
  status: string
  plan: string
  created_at: string
  updated_at: string
  raw_events_7d: number
  latest_event: string | null
  public_key_count: number
  server_key_count: number
  key_prefixes: string[]
}

export interface ControlPlaneData {
  tenants: TenantRecord[]
  sites: SiteRecord[]
}

export async function ensureControlPlaneSchema() {
  await clickhouseCommand("ALTER TABLE tracer.tenants ADD COLUMN IF NOT EXISTS contact_email String DEFAULT ''")
  await clickhouseCommand(`
    CREATE TABLE IF NOT EXISTS tracer.tenant_users
    (
      user_id    String,
      tenant_id  String,
      email      String,
      full_name  String,
      role       LowCardinality(String) DEFAULT 'owner',
      status     LowCardinality(String) DEFAULT 'active',
      created_at DateTime64(3, 'UTC') DEFAULT now64(3),
      updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
    )
    ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (tenant_id, user_id)
  `)
}

export async function loadControlPlane(): Promise<ControlPlaneData> {
  await ensureControlPlaneSchema()

  const [tenantRows, siteRows, eventRows, keyRows] = await Promise.all([
    clickhouseQuery(`
      SELECT
        tenant_id,
        name,
        contact_email,
        plan,
        status,
        created_at,
        updated_at
      FROM tracer.tenants
      ORDER BY updated_at DESC
      LIMIT 50
    `),
    clickhouseQuery(`
      SELECT
        site_id,
        tenant_id,
        domain,
        platform,
        allowed_origins,
        timezone,
        status,
        plan,
        created_at,
        updated_at
      FROM tracer.sites
      ORDER BY updated_at DESC
      LIMIT 100
    `),
    clickhouseQuery(`
      SELECT
        site_id,
        count() AS raw_events_7d,
        max(received_at) AS latest_event
      FROM tracer.ecommerce_events
      WHERE event_timestamp >= now() - INTERVAL 7 DAY
      GROUP BY site_id
    `),
    clickhouseQuery(`
      SELECT
        site_id,
        countIf(key_type = 'public_write' AND status = 'active' AND revoked_at IS NULL) AS public_key_count,
        countIf(key_type = 'server_secret' AND status = 'active' AND revoked_at IS NULL) AS server_key_count,
        groupArrayIf(key_prefix, status = 'active' AND revoked_at IS NULL) AS key_prefixes
      FROM tracer.site_keys FINAL
      GROUP BY site_id
    `),
  ])

  const eventsBySite = new Map(
    eventRows.map((row) => [
      str(row.site_id),
      {
        raw_events_7d: num(row.raw_events_7d),
        latest_event: row.latest_event == null ? null : str(row.latest_event),
      },
    ])
  )
  const keysBySite = new Map(
    keyRows.map((row) => [
      str(row.site_id),
      {
        public_key_count: num(row.public_key_count),
        server_key_count: num(row.server_key_count),
        key_prefixes: Array.isArray(row.key_prefixes) ? row.key_prefixes.map((value) => String(value)) : [],
      },
    ])
  )

  return {
    tenants: tenantRows.map((row) => ({
      tenant_id: str(row.tenant_id),
      name: str(row.name),
      contact_email: str(row.contact_email),
      plan: str(row.plan, "starter"),
      status: str(row.status, "active"),
      created_at: str(row.created_at),
      updated_at: str(row.updated_at),
    })),
    sites: siteRows.map((row) => {
      const eventStats = eventsBySite.get(str(row.site_id)) || { raw_events_7d: 0, latest_event: null }
      const keyStats = keysBySite.get(str(row.site_id)) || {
        public_key_count: 0,
        server_key_count: 0,
        key_prefixes: [],
      }

      return {
        site_id: str(row.site_id),
        tenant_id: str(row.tenant_id),
        domain: str(row.domain),
        platform: str(row.platform),
        allowed_origins: Array.isArray(row.allowed_origins) ? row.allowed_origins.map((value) => String(value)) : [],
        timezone: str(row.timezone, "UTC"),
        status: str(row.status, "active"),
        plan: str(row.plan, "starter"),
        created_at: str(row.created_at),
        updated_at: str(row.updated_at),
        ...eventStats,
        ...keyStats,
      }
    }),
  }
}
