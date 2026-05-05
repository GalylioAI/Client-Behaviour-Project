import { randomUUID } from "node:crypto"

import { clickhouseCommand, clickhouseInsertJson, clickhouseQuery, sqlString, str } from "@/lib/clickhouse"

const APP_BASE_URL = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://192.168.1.109:3100").replace(/\/$/, "")
const WEBHOOK_URL = "https://tracker.yatootunisie.tn/webhook"
const WP_SOURCE_URL = "https://github.com/GalylioAI/Client-Behaviour-Project/tree/wp"
const PRESTA_SOURCE_URL = "https://github.com/GalylioAI/Client-Behaviour-Project/tree/Prestashop_module"

export interface PreparedOnboardingEmail {
  email_id: string
  tenant_id: string
  site_id: string
  to_email: string
  subject: string
  preview_text: string
  status: string
  provider: string
  dashboard_url: string
  connect_url: string
  body_text: string
  body_html: string
  created_at: string
  sent_at: string | null
  updated_at: string
}

export interface CreateOnboardingEmailInput {
  tenantId: string
  siteId: string
  tenantName: string
  adminEmail: string
  domain: string
  platform: string
  publicWriteKey: string
}

export async function ensureEmailOutboxSchema() {
  await clickhouseCommand(`
    CREATE TABLE IF NOT EXISTS tracer.onboarding_email_outbox
    (
      email_id      String,
      tenant_id     String,
      site_id       String,
      to_email      String,
      subject       String,
      preview_text  String,
      status        LowCardinality(String) DEFAULT 'prepared',
      provider      LowCardinality(String) DEFAULT 'mock',
      dashboard_url String,
      connect_url   String,
      body_text     String,
      body_html     String,
      created_at    DateTime64(3, 'UTC') DEFAULT now64(3),
      sent_at       Nullable(DateTime64(3, 'UTC')),
      updated_at    DateTime64(3, 'UTC') DEFAULT now64(3)
    )
    ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (site_id, email_id)
  `)
}

function pluginSource(platform: string) {
  if (platform === "wordpress" || platform === "woocommerce") {
    return {
      name: "WordPress / WooCommerce tracker",
      sourceUrl: WP_SOURCE_URL,
      installArea: "WordPress admin -> Settings -> Behaviour Tracker",
    }
  }

  if (platform === "prestashop") {
    return {
      name: "PrestaShop tracker module",
      sourceUrl: PRESTA_SOURCE_URL,
      installArea: "PrestaShop admin -> Modules -> Customer Behaviour Tracker -> Configure",
    }
  }

  return {
    name: "Custom tracker integration",
    sourceUrl: WP_SOURCE_URL,
    installArea: "Your custom integration settings",
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function buildEmail(input: CreateOnboardingEmailInput) {
  const plugin = pluginSource(input.platform)
  const connectUrl = `${APP_BASE_URL}/connect?site_id=${encodeURIComponent(input.siteId)}`
  const dashboardUrl = `${APP_BASE_URL}/?site_id=${encodeURIComponent(input.siteId)}`
  const debugUrl = `${APP_BASE_URL}/debug?site_id=${encodeURIComponent(input.siteId)}`
  const subject = `Your BehaviourAI tracker access for ${input.domain || input.siteId}`
  const previewText = "Install your open-source tracker, paste your public key, then verify live events."

  const bodyText = [
    `Hi ${input.tenantName},`,
    "",
    `Your BehaviourAI workspace is ready for ${input.domain || input.siteId}.`,
    "",
    "Connection wizard:",
    connectUrl,
    "",
    "Dashboard:",
    dashboardUrl,
    "",
    "Tracker setup values:",
    `site_id: ${input.siteId}`,
    `webhook_url: ${WEBHOOK_URL}`,
    `public_write_key: ${input.publicWriteKey}`,
    "",
    "Important security note:",
    "The server secret key is not included in this email. It is shown once on the access page and should stay private in server-side configuration only.",
    "",
    "Open-source tracker:",
    `${plugin.name}: ${plugin.sourceUrl}`,
    "You can inspect the plugin code yourself before installing it.",
    "",
    "Install location:",
    plugin.installArea,
    "",
    "Troubleshooting:",
    debugUrl,
    "",
    "BehaviourAI",
  ].join("\n")

  const bodyHtml = `
    <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2>Your BehaviourAI workspace is ready</h2>
      <p>Hi ${escapeHtml(input.tenantName)},</p>
      <p>Your workspace is ready for <strong>${escapeHtml(input.domain || input.siteId)}</strong>.</p>

      <p><a href="${connectUrl}">Open the connection wizard</a></p>
      <p><a href="${dashboardUrl}">Open the dashboard</a></p>

      <h3>Tracker setup values</h3>
      <ul>
        <li><strong>site_id:</strong> <code>${escapeHtml(input.siteId)}</code></li>
        <li><strong>webhook_url:</strong> <code>${WEBHOOK_URL}</code></li>
        <li><strong>public_write_key:</strong> <code>${escapeHtml(input.publicWriteKey)}</code></li>
      </ul>

      <p><strong>Security note:</strong> the server secret key is not included in this email. It is shown once on the access page and should stay private in server-side configuration only.</p>

      <h3>Open-source tracker</h3>
      <p>The tracker plugin is open source, so you can inspect the code before installing it:</p>
      <p><a href="${plugin.sourceUrl}">${escapeHtml(plugin.name)}</a></p>

      <h3>Troubleshooting</h3>
      <p>If the tracker does not connect, use the debugger: <a href="${debugUrl}">${debugUrl}</a></p>
    </div>
  `.trim()

  return {
    subject,
    previewText,
    connectUrl,
    dashboardUrl,
    bodyText,
    bodyHtml,
  }
}

export async function prepareOnboardingEmail(input: CreateOnboardingEmailInput) {
  await ensureEmailOutboxSchema()

  const email = buildEmail(input)
  const emailId = `email_${input.siteId}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`

  await clickhouseInsertJson("tracer.onboarding_email_outbox", {
    email_id: emailId,
    tenant_id: input.tenantId,
    site_id: input.siteId,
    to_email: input.adminEmail,
    subject: email.subject,
    preview_text: email.previewText,
    status: "prepared",
    provider: "mock",
    dashboard_url: email.dashboardUrl,
    connect_url: email.connectUrl,
    body_text: email.bodyText,
    body_html: email.bodyHtml,
    sent_at: null,
  })

  return {
    email_id: emailId,
    to_email: input.adminEmail,
    subject: email.subject,
    status: "prepared",
    provider: "mock",
    connect_url: email.connectUrl,
    dashboard_url: email.dashboardUrl,
  }
}

export async function loadOnboardingEmails(tenantId?: string): Promise<PreparedOnboardingEmail[]> {
  await ensureEmailOutboxSchema()

  const rows = await clickhouseQuery(`
    SELECT
      email_id,
      tenant_id,
      site_id,
      to_email,
      subject,
      preview_text,
      status,
      provider,
      dashboard_url,
      connect_url,
      body_text,
      body_html,
      created_at,
      sent_at,
      updated_at
    FROM tracer.onboarding_email_outbox
    ${tenantId ? `WHERE tenant_id = ${sqlString(tenantId)}` : ""}
    ORDER BY created_at DESC
    LIMIT 100
  `)

  return rows.map((row) => ({
    email_id: str(row.email_id),
    tenant_id: str(row.tenant_id),
    site_id: str(row.site_id),
    to_email: str(row.to_email),
    subject: str(row.subject),
    preview_text: str(row.preview_text),
    status: str(row.status, "prepared"),
    provider: str(row.provider, "mock"),
    dashboard_url: str(row.dashboard_url),
    connect_url: str(row.connect_url),
    body_text: str(row.body_text),
    body_html: str(row.body_html),
    created_at: str(row.created_at),
    sent_at: row.sent_at == null || row.sent_at === "" ? null : str(row.sent_at),
    updated_at: str(row.updated_at),
  }))
}
