import { clickhouseCommand, clickhouseInsertJson, clickhouseQuery, num, sqlString, str } from "@/lib/clickhouse"
import { canAccessSite } from "@/lib/tenant-access"

export const DEFAULT_AUTOMATION_INTENSITY = 5

export interface SiteAutomationSettings {
  site_id: string
  tenant_id: string
  recommendation_intensity: number
  sending_mode: "draft_only" | "manual_approval" | "auto_send"
  max_emails_per_customer_week: number
  cooldown_hours: number
  consent_required: boolean
  updated_at: string
}

function clampIntensity(value: unknown) {
  const parsed = Math.round(Number(value))
  if (!Number.isFinite(parsed)) return DEFAULT_AUTOMATION_INTENSITY
  return Math.min(Math.max(parsed, 1), 10)
}

export async function ensureAutomationSettingsSchema() {
  await clickhouseCommand(`
    CREATE TABLE IF NOT EXISTS tracer.site_automation_settings
    (
      site_id String,
      tenant_id String,
      recommendation_intensity UInt8 DEFAULT 5,
      sending_mode LowCardinality(String) DEFAULT 'draft_only',
      max_emails_per_customer_week UInt8 DEFAULT 2,
      cooldown_hours UInt16 DEFAULT 72,
      consent_required UInt8 DEFAULT 1,
      created_at DateTime64(3, 'UTC') DEFAULT now64(3),
      updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
    )
    ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (tenant_id, site_id)
  `)
}

export async function loadAutomationSettings(siteId: string, tenantId?: string): Promise<SiteAutomationSettings> {
  await ensureAutomationSettingsSchema()

  const rows = await clickhouseQuery(`
    SELECT
      site_id,
      tenant_id,
      recommendation_intensity,
      sending_mode,
      max_emails_per_customer_week,
      cooldown_hours,
      consent_required,
      updated_at
    FROM tracer.site_automation_settings FINAL
    WHERE site_id = ${sqlString(siteId)}
      ${tenantId ? `AND tenant_id = ${sqlString(tenantId)}` : ""}
    ORDER BY updated_at DESC
    LIMIT 1
  `)

  const row = rows[0]
  return {
    site_id: siteId,
    tenant_id: tenantId || str(row?.tenant_id),
    recommendation_intensity: clampIntensity(row?.recommendation_intensity),
    sending_mode: str(row?.sending_mode, "draft_only") as SiteAutomationSettings["sending_mode"],
    max_emails_per_customer_week: num(row?.max_emails_per_customer_week, 2),
    cooldown_hours: num(row?.cooldown_hours, 72),
    consent_required: num(row?.consent_required, 1) === 1,
    updated_at: str(row?.updated_at),
  }
}

export async function saveAutomationSettings({
  siteId,
  tenantId,
  recommendationIntensity,
}: {
  siteId: string
  tenantId: string
  recommendationIntensity: number
}) {
  await ensureAutomationSettingsSchema()

  if (!(await canAccessSite(tenantId, siteId))) {
    throw new Error(`Active site "${siteId}" was not found for this tenant.`)
  }

  const intensity = clampIntensity(recommendationIntensity)
  await clickhouseInsertJson("tracer.site_automation_settings", {
    site_id: siteId,
    tenant_id: tenantId,
    recommendation_intensity: intensity,
    sending_mode: "draft_only",
    max_emails_per_customer_week: 2,
    cooldown_hours: 72,
    consent_required: 1,
  })

  return loadAutomationSettings(siteId, tenantId)
}
