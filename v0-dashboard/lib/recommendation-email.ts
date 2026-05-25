import { clickhouseCommand, clickhouseQuery, sqlString, str, num } from "@/lib/clickhouse"

export interface PreparedRecommendationEmail {
  email_id: string
  campaign_key: string
  tenant_id: string
  site_id: string
  visitor_id: string
  customer_id: string
  to_email: string
  subject: string
  preview_text: string
  status: string
  provider: string
  recommendation_ids: string[]
  product_ids: string[]
  product_count: number
  body_text: string
  body_html: string
  generated_at: string
  created_at: string
  sent_at: string | null
  updated_at: string
}

export async function ensureRecommendationEmailOutboxSchema() {
  await clickhouseCommand(`
    CREATE TABLE IF NOT EXISTS tracer.recommendation_email_outbox
    (
      email_id           String,
      campaign_key      String,
      tenant_id         String,
      site_id           LowCardinality(String),
      visitor_id        String,
      customer_id       String,
      to_email          String,
      subject           String,
      preview_text      String,
      status            LowCardinality(String) DEFAULT 'prepared',
      provider          LowCardinality(String) DEFAULT 'mock',
      recommendation_ids Array(String),
      product_ids       Array(String),
      body_text         String,
      body_html         String,
      generated_at      DateTime64(3, 'UTC'),
      created_at        DateTime64(3, 'UTC') DEFAULT now64(3),
      sent_at           Nullable(DateTime64(3, 'UTC')),
      updated_at        DateTime64(3, 'UTC') DEFAULT now64(3)
    )
    ENGINE = ReplacingMergeTree(updated_at)
    PARTITION BY toYYYYMM(created_at)
    ORDER BY (site_id, campaign_key, to_email)
  `)
}

export async function loadRecommendationEmails(tenantId?: string, siteId?: string): Promise<PreparedRecommendationEmail[]> {
  await ensureRecommendationEmailOutboxSchema()

  const filters = [
    tenantId ? `tenant_id = ${sqlString(tenantId)}` : "",
    siteId ? `site_id = ${sqlString(siteId)}` : "",
  ].filter(Boolean)

  const rows = await clickhouseQuery(`
    SELECT
      email_id,
      campaign_key,
      tenant_id,
      site_id,
      visitor_id,
      customer_id,
      to_email,
      subject,
      preview_text,
      status,
      provider,
      recommendation_ids,
      product_ids,
      length(product_ids) AS product_count,
      body_text,
      body_html,
      generated_at,
      created_at,
      sent_at,
      updated_at
    FROM tracer.recommendation_email_outbox FINAL
    ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
    ORDER BY updated_at DESC
    LIMIT 100
  `)

  return rows.map((row) => ({
    email_id: str(row.email_id),
    campaign_key: str(row.campaign_key),
    tenant_id: str(row.tenant_id),
    site_id: str(row.site_id),
    visitor_id: str(row.visitor_id),
    customer_id: str(row.customer_id),
    to_email: str(row.to_email),
    subject: str(row.subject),
    preview_text: str(row.preview_text),
    status: str(row.status, "prepared"),
    provider: str(row.provider, "mock"),
    recommendation_ids: Array.isArray(row.recommendation_ids) ? row.recommendation_ids.map(String) : [],
    product_ids: Array.isArray(row.product_ids) ? row.product_ids.map(String) : [],
    product_count: num(row.product_count),
    body_text: str(row.body_text),
    body_html: str(row.body_html),
    generated_at: str(row.generated_at),
    created_at: str(row.created_at),
    sent_at: row.sent_at == null || row.sent_at === "" ? null : str(row.sent_at),
    updated_at: str(row.updated_at),
  }))
}
