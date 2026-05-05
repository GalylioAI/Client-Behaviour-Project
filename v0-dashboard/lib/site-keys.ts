import { createHash, randomBytes, randomUUID } from "node:crypto"

import { clickhouseCommand, clickhouseQuery, num, sqlString, str } from "@/lib/clickhouse"

export type ManagedKeyType = "public_write" | "server_secret"

export interface ManagedSite {
  site_id: string
  tenant_id: string
  domain: string
  platform: string
  status: string
  plan: string
  timezone: string
  allowed_origins: string[]
}

export interface ManagedSiteKey {
  key_id: string
  site_id: string
  key_type: ManagedKeyType
  key_prefix: string
  status: string
  created_at: string
  revoked_at: string | null
  updated_at: string
}

export interface ApiKeyManagementData {
  selectedSiteId: string
  sites: ManagedSite[]
  keys: ManagedSiteKey[]
  stats: {
    events_24h: number
    accepted_24h: number
    rejected_24h: number
    last_event_at: string | null
  }
}

export interface RotatedKeyResult {
  site_id: string
  key_id: string
  key_type: ManagedKeyType
  public_value: string
  key_prefix: string
  revoked_key_ids: string[]
  cache_note: string
}

const KEY_PREFIXES: Record<ManagedKeyType, "pk_live_" | "sk_live_"> = {
  public_write: "pk_live_",
  server_secret: "sk_live_",
}

function getSiteId(siteId?: string) {
  return siteId || process.env.DASHBOARD_SITE_ID || "tdiscount"
}

function normalizeKeyType(value: unknown): ManagedKeyType {
  return value === "server_secret" ? "server_secret" : "public_write"
}

function makeKey(type: ManagedKeyType) {
  return `${KEY_PREFIXES[type]}${randomBytes(24).toString("hex")}`
}

function keyHash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

export async function loadApiKeyManagement(siteId?: string): Promise<ApiKeyManagementData> {
  const requestedSiteId = getSiteId(siteId)

  const siteRows = await clickhouseQuery(`
    SELECT
      site_id,
      tenant_id,
      domain,
      platform,
      status,
      plan,
      timezone,
      allowed_origins
    FROM tracer.sites
    ORDER BY updated_at DESC
    LIMIT 100
  `)

  const sites = siteRows.map((row) => ({
    site_id: str(row.site_id),
    tenant_id: str(row.tenant_id),
    domain: str(row.domain),
    platform: str(row.platform),
    status: str(row.status, "active"),
    plan: str(row.plan, "starter"),
    timezone: str(row.timezone, "UTC"),
    allowed_origins: Array.isArray(row.allowed_origins) ? row.allowed_origins.map((value) => String(value)) : [],
  }))

  const selectedSiteId = sites.some((site) => site.site_id === requestedSiteId)
    ? requestedSiteId
    : sites[0]?.site_id || requestedSiteId
  const quotedSite = sqlString(selectedSiteId)

  const [keyRows, eventRows, auditRows] = await Promise.all([
    clickhouseQuery(`
      SELECT
        key_id,
        site_id,
        key_type,
        key_prefix,
        status,
        created_at,
        revoked_at,
        updated_at
      FROM tracer.site_keys FINAL
      WHERE site_id = ${quotedSite}
      ORDER BY created_at DESC
      LIMIT 50
    `),
    clickhouseQuery(`
      SELECT
        countIf(received_at >= now() - INTERVAL 24 HOUR) AS events_24h,
        max(received_at) AS last_event_at
      FROM tracer.ecommerce_events
      WHERE site_id = ${quotedSite}
        AND received_at >= now() - INTERVAL 24 HOUR
    `),
    clickhouseQuery(`
      SELECT
        countIf(status = 'accepted' AND received_at >= now() - INTERVAL 24 HOUR) AS accepted_24h,
        countIf(status != 'accepted' AND received_at >= now() - INTERVAL 24 HOUR) AS rejected_24h
      FROM tracer.event_ingest_audit
      WHERE site_id = ${quotedSite}
        AND received_at >= now() - INTERVAL 24 HOUR
    `),
  ])

  return {
    selectedSiteId,
    sites,
    keys: keyRows.map((row) => ({
      key_id: str(row.key_id),
      site_id: str(row.site_id),
      key_type: normalizeKeyType(row.key_type),
      key_prefix: str(row.key_prefix),
      status: str(row.status, "active"),
      created_at: str(row.created_at),
      revoked_at: row.revoked_at == null ? null : str(row.revoked_at),
      updated_at: str(row.updated_at),
    })),
    stats: {
      events_24h: num(eventRows[0]?.events_24h),
      accepted_24h: num(auditRows[0]?.accepted_24h),
      rejected_24h: num(auditRows[0]?.rejected_24h),
      last_event_at: eventRows[0]?.last_event_at == null ? null : str(eventRows[0]?.last_event_at),
    },
  }
}

export async function rotateSiteKey(siteId: string, keyType: ManagedKeyType): Promise<RotatedKeyResult> {
  const normalizedSiteId = siteId.trim()
  const normalizedKeyType = normalizeKeyType(keyType)

  if (!normalizedSiteId) {
    throw new Error("site_id is required.")
  }

  const siteRows = await clickhouseQuery<{ rows: number }>(`
    SELECT count() AS rows
    FROM tracer.sites
    WHERE site_id = ${sqlString(normalizedSiteId)}
      AND status = 'active'
  `)

  if (!num(siteRows[0]?.rows)) {
    throw new Error(`Active site "${normalizedSiteId}" was not found.`)
  }

  const activeRows = await clickhouseQuery<{ key_id: string; created_at: string }>(`
    SELECT key_id, created_at
    FROM tracer.site_keys FINAL
    WHERE site_id = ${sqlString(normalizedSiteId)}
      AND key_type = ${sqlString(normalizedKeyType)}
      AND status = 'active'
      AND revoked_at IS NULL
  `)

  const newKey = makeKey(normalizedKeyType)
  const nowId = Date.now().toString(36)
  const keyId = `key_${normalizedSiteId}_${normalizedKeyType}_${nowId}_${randomUUID().slice(0, 8)}`

  const values = [
    ...activeRows.map(
      (row) => `(
        ${sqlString(str(row.key_id))},
        ${sqlString(normalizedSiteId)},
        ${sqlString(normalizedKeyType)},
        '',
        ${sqlString("0".repeat(64))},
        'revoked',
        ${sqlString(str(row.created_at))},
        now64(3),
        now64(3)
      )`
    ),
    `(
      ${sqlString(keyId)},
      ${sqlString(normalizedSiteId)},
      ${sqlString(normalizedKeyType)},
      ${sqlString(newKey.slice(0, 16))},
      ${sqlString(keyHash(newKey))},
      'active',
      now64(3),
      NULL,
      now64(3)
    )`,
  ]

  await clickhouseCommand(`
    INSERT INTO tracer.site_keys
      (key_id, site_id, key_type, key_prefix, key_hash, status, created_at, revoked_at, updated_at)
    VALUES
      ${values.join(",\n")}
  `)

  return {
    site_id: normalizedSiteId,
    key_id: keyId,
    key_type: normalizedKeyType,
    public_value: newKey,
    key_prefix: newKey.slice(0, 16),
    revoked_key_ids: activeRows.map((row) => str(row.key_id)).filter(Boolean),
    cache_note: "The bridge cache may take up to 60 seconds to forget the old key.",
  }
}
