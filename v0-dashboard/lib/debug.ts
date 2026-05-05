import { clickhouseQuery, num, sqlString, str } from "@/lib/clickhouse"

export interface DebugSite {
  site_id: string
  tenant_id: string
  domain: string
  platform: string
  status: string
  allowed_origins: string[]
  public_key_count: number
  server_key_count: number
  events_5m: number
  events_1h: number
  events_24h: number
  last_event_at: string | null
  accepted_1h: number
  rejected_1h: number
  last_accepted_at: string | null
  last_rejected_at: string | null
}

export interface AuditRow {
  audit_id: string
  received_at: string
  status: string
  http_status: number
  site_id: string
  platform: string
  source: string
  client_ip: string
  origin: string
  referer: string
  user_agent: string
  event_count: number
  sent_count: number
  failed_count: number
  is_unload: boolean
  reason: string
  key_present: boolean
  key_prefix: string
  sample_event_name: string
  sample_event_type: string
  sample_page_url: string
}

export interface RecentEventRow {
  received_at: string
  site_id: string
  platform: string
  event_name: string
  event_type: string
  source: string
  session_id: string
  page_url: string
}

export interface FieldHealth {
  total: number
  missing_site_id: number
  missing_session_id: number
  missing_visitor_id: number
  missing_event_name: number
  missing_page_url: number
}

export interface BridgeStatus {
  ok: boolean
  url: string
  health: {
    status?: string
    topic?: string
    site_registry_enabled?: boolean
    site_registry_compat_allow_missing_key?: boolean
    ingest_audit_enabled?: boolean
  } | null
  metrics: Record<string, number>
  error?: string
}

export interface DebugData {
  selectedSiteId: string
  sites: DebugSite[]
  audits: AuditRow[]
  recentEvents: RecentEventRow[]
  fieldHealth: FieldHealth
  bridge: BridgeStatus
}

function maybeDate(value: unknown) {
  return value == null || value === "" ? null : str(value)
}

async function safeQuery<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  try {
    return await clickhouseQuery<T>(sql)
  } catch {
    return []
  }
}

function parseMetricSum(text: string, name: string) {
  const pattern = new RegExp(`^${name}(?:\\{[^}]*\\})?\\s+([0-9.]+)$`, "gm")
  let total = 0
  for (const match of text.matchAll(pattern)) {
    total += Number(match[1] || 0)
  }
  return total
}

async function loadBridgeStatus(): Promise<BridgeStatus> {
  const url = process.env.BRIDGE_URL || "http://192.168.1.105:8080"
  try {
    const [healthResponse, metricsResponse] = await Promise.all([
      fetch(`${url}/health`, { cache: "no-store", signal: AbortSignal.timeout(3000) }),
      fetch(`${url}/metrics`, { cache: "no-store", signal: AbortSignal.timeout(3000) }),
    ])
    if (!healthResponse.ok || !metricsResponse.ok) {
      throw new Error(`Bridge returned ${healthResponse.status}/${metricsResponse.status}`)
    }
    const health = await healthResponse.json()
    const metricsText = await metricsResponse.text()
    const metrics = {
      received: parseMetricSum(metricsText, "bridge_events_received_total"),
      sent: parseMetricSum(metricsText, "bridge_events_sent_total"),
      failed: parseMetricSum(metricsText, "bridge_events_failed_total"),
      auth_rejected: parseMetricSum(metricsText, "bridge_events_auth_rejected_total"),
      kafka_errors: parseMetricSum(metricsText, "bridge_kafka_errors_total"),
      batches: parseMetricSum(metricsText, "bridge_batches_received_total"),
      uptime_seconds: parseMetricSum(metricsText, "bridge_uptime_seconds"),
    }

    return { ok: true, url, health, metrics }
  } catch (error) {
    return {
      ok: false,
      url,
      health: null,
      metrics: {},
      error: error instanceof Error ? error.message : "Bridge unavailable",
    }
  }
}

export async function loadDebugData(siteId?: string): Promise<DebugData> {
  const siteRows = await safeQuery(`
    SELECT
      site_id,
      tenant_id,
      domain,
      platform,
      status,
      allowed_origins
    FROM tracer.sites
    ORDER BY updated_at DESC
    LIMIT 100
  `)

  const selectedSiteId = siteId || str(siteRows[0]?.site_id, "tdiscount")
  const quotedSite = sqlString(selectedSiteId)

  const [eventStatsRows, auditStatsRows, keyRows, auditRows, recentEventRows, fieldRows, bridge] = await Promise.all([
    safeQuery(`
      SELECT
        site_id,
        countIf(received_at >= now() - INTERVAL 5 MINUTE) AS events_5m,
        countIf(received_at >= now() - INTERVAL 1 HOUR) AS events_1h,
        countIf(received_at >= now() - INTERVAL 24 HOUR) AS events_24h,
        max(received_at) AS last_event_at
      FROM tracer.ecommerce_events
      WHERE received_at >= now() - INTERVAL 24 HOUR
      GROUP BY site_id
    `),
    safeQuery(`
      SELECT
        site_id,
        countIf(status = 'accepted' AND received_at >= now() - INTERVAL 1 HOUR) AS accepted_1h,
        countIf(status != 'accepted' AND received_at >= now() - INTERVAL 1 HOUR) AS rejected_1h,
        maxIf(received_at, status = 'accepted') AS last_accepted_at,
        maxIf(received_at, status != 'accepted') AS last_rejected_at
      FROM tracer.event_ingest_audit
      WHERE received_at >= now() - INTERVAL 24 HOUR
      GROUP BY site_id
    `),
    safeQuery(`
      SELECT
        site_id,
        countIf(key_type = 'public_write' AND status = 'active' AND revoked_at IS NULL) AS public_key_count,
        countIf(key_type = 'server_secret' AND status = 'active' AND revoked_at IS NULL) AS server_key_count
      FROM tracer.site_keys
      GROUP BY site_id
    `),
    safeQuery(`
      SELECT
        audit_id,
        received_at,
        status,
        http_status,
        site_id,
        platform,
        source,
        client_ip,
        origin,
        referer,
        user_agent,
        event_count,
        sent_count,
        failed_count,
        is_unload,
        reason,
        key_present,
        key_prefix,
        sample_event_name,
        sample_event_type,
        sample_page_url
      FROM tracer.event_ingest_audit
      WHERE site_id = ${quotedSite}
      ORDER BY received_at DESC
      LIMIT 80
    `),
    safeQuery(`
      SELECT
        received_at,
        site_id,
        platform,
        event_name,
        event_type,
        source,
        session_id,
        page_url
      FROM tracer.ecommerce_events
      WHERE site_id = ${quotedSite}
      ORDER BY received_at DESC
      LIMIT 40
    `),
    safeQuery(`
      SELECT
        count() AS total,
        countIf(site_id = '') AS missing_site_id,
        countIf(session_id = '') AS missing_session_id,
        countIf(isNull(visitor_id) OR visitor_id = '') AS missing_visitor_id,
        countIf(event_name = '' OR event_name = 'unknown') AS missing_event_name,
        countIf(isNull(page_url) OR page_url = '') AS missing_page_url
      FROM tracer.ecommerce_events
      WHERE site_id = ${quotedSite}
        AND received_at >= now() - INTERVAL 24 HOUR
    `),
    loadBridgeStatus(),
  ])

  const eventsBySite = new Map(eventStatsRows.map((row) => [str(row.site_id), row]))
  const auditBySite = new Map(auditStatsRows.map((row) => [str(row.site_id), row]))
  const keysBySite = new Map(keyRows.map((row) => [str(row.site_id), row]))

  const sites = siteRows.map((row) => {
    const eventStats = eventsBySite.get(str(row.site_id)) || {}
    const auditStats = auditBySite.get(str(row.site_id)) || {}
    const keyStats = keysBySite.get(str(row.site_id)) || {}

    return {
      site_id: str(row.site_id),
      tenant_id: str(row.tenant_id),
      domain: str(row.domain),
      platform: str(row.platform),
      status: str(row.status, "active"),
      allowed_origins: Array.isArray(row.allowed_origins) ? row.allowed_origins.map((value) => String(value)) : [],
      public_key_count: num(keyStats.public_key_count),
      server_key_count: num(keyStats.server_key_count),
      events_5m: num(eventStats.events_5m),
      events_1h: num(eventStats.events_1h),
      events_24h: num(eventStats.events_24h),
      last_event_at: maybeDate(eventStats.last_event_at),
      accepted_1h: num(auditStats.accepted_1h),
      rejected_1h: num(auditStats.rejected_1h),
      last_accepted_at: maybeDate(auditStats.last_accepted_at),
      last_rejected_at: maybeDate(auditStats.last_rejected_at),
    }
  })

  const fieldHealthRow = fieldRows[0] || {}

  return {
    selectedSiteId,
    sites,
    audits: auditRows.map((row) => ({
      audit_id: str(row.audit_id),
      received_at: str(row.received_at),
      status: str(row.status),
      http_status: num(row.http_status),
      site_id: str(row.site_id),
      platform: str(row.platform),
      source: str(row.source),
      client_ip: str(row.client_ip),
      origin: str(row.origin),
      referer: str(row.referer),
      user_agent: str(row.user_agent),
      event_count: num(row.event_count),
      sent_count: num(row.sent_count),
      failed_count: num(row.failed_count),
      is_unload: num(row.is_unload) === 1,
      reason: str(row.reason),
      key_present: num(row.key_present) === 1,
      key_prefix: str(row.key_prefix),
      sample_event_name: str(row.sample_event_name),
      sample_event_type: str(row.sample_event_type),
      sample_page_url: str(row.sample_page_url),
    })),
    recentEvents: recentEventRows.map((row) => ({
      received_at: str(row.received_at),
      site_id: str(row.site_id),
      platform: str(row.platform),
      event_name: str(row.event_name),
      event_type: str(row.event_type),
      source: str(row.source),
      session_id: str(row.session_id),
      page_url: str(row.page_url),
    })),
    fieldHealth: {
      total: num(fieldHealthRow.total),
      missing_site_id: num(fieldHealthRow.missing_site_id),
      missing_session_id: num(fieldHealthRow.missing_session_id),
      missing_visitor_id: num(fieldHealthRow.missing_visitor_id),
      missing_event_name: num(fieldHealthRow.missing_event_name),
      missing_page_url: num(fieldHealthRow.missing_page_url),
    },
    bridge,
  }
}
