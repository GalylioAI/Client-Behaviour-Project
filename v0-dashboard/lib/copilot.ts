import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { runCopilotTools, type CopilotToolResult } from "@/lib/copilot-tools"
import type { ProductInsight } from "@/lib/dashboard-types"
import type { BehaviorInsights } from "@/lib/insights"

export type CopilotRole = "user" | "assistant"

export interface CopilotMessage {
  role: CopilotRole
  content: string
}

export interface CopilotAction {
  label: string
  href: string
  reason: string
}

export interface CopilotResponse {
  answer: string
  mode: "mock" | "llm"
  model: string
  data_as_of: string
  suggested_actions: CopilotAction[]
  sources: string[]
  tools_used: string[]
}

export interface CopilotDashboardInsights {
  alert: ProductInsight
  recommendations: ProductInsight[]
  mode: "mock" | "llm"
  model: string
  data_as_of: string
  sources: string[]
  error?: string
}

type SiteSnapshot = ReturnType<typeof buildSiteSnapshot>

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge", "copilot")
let knowledgeCache: { text: string; sources: string[] } | null = null

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round((value || 0) * factor) / factor
}

function dataAsOf(insights: BehaviorInsights) {
  return insights.operations.recent_events[0]?.received_at || insights.dataset.date_range_utc.max || new Date().toISOString()
}

function topItems<T>(items: T[], limit: number) {
  return items.slice(0, limit)
}

export function buildSiteSnapshot(insights: BehaviorInsights) {
  const intent = insights.ml.purchase_intent
  const siteId = insights.operations.site.site_id || "unknown"

  return {
    generated_at: new Date().toISOString(),
    data_as_of: dataAsOf(insights),
    site: {
      site_id: siteId,
      domain: insights.operations.site.domain,
      platform: insights.operations.site.platform,
      status: insights.operations.site.status,
      plan: insights.operations.site.plan,
      timezone: insights.operations.site.timezone || "UTC",
    },
    business_overview: {
      sessions: insights.business_overview.reach.sessions,
      visitors: insights.business_overview.reach.visitors,
      raw_events: insights.business_overview.reach.raw_events,
      revenue_tnd: round(insights.business_overview.sales.revenue_tnd),
      net_revenue_tnd: round(insights.business_overview.sales.net_revenue_tnd),
      average_order_value_tnd: insights.business_overview.sales.average_order_value_tnd == null
        ? null
        : round(insights.business_overview.sales.average_order_value_tnd),
      conversion_rate_pct: round(insights.business_overview.conversion.session_to_purchase_rate_pct),
      cart_to_purchase_rate_pct: round(insights.business_overview.conversion.cart_to_purchase_rate_pct),
      checkout_to_purchase_rate_pct: round(insights.business_overview.conversion.checkout_to_purchase_rate_pct),
      cart_sessions: insights.business_overview.conversion.cart_sessions,
      checkout_sessions: insights.business_overview.conversion.checkout_sessions,
      purchase_sessions: insights.business_overview.conversion.purchase_sessions,
      cancelled_orders: insights.business_overview.sales.cancelled_orders,
      refunded_orders: insights.business_overview.sales.refunded_orders,
      failed_orders: insights.business_overview.sales.failed_orders,
    },
    acquisition: {
      channels: topItems(insights.acquisition.acquisition_channels, 6).map((row) => ({
        channel: row.channel,
        sessions: row.sessions,
        purchases: row.purchases,
        revenue: round(row.revenue),
        share_pct: round(row.share_pct),
      })),
      campaigns: topItems(insights.acquisition.campaign_sources, 6).map((row) => ({
        source: row.source,
        medium: row.medium,
        campaign: row.campaign,
        sessions: row.sessions,
        purchases: row.purchases,
        revenue: round(row.revenue),
      })),
      referrers: topItems(insights.acquisition.top_referrers, 6).map((row) => ({
        source: row.source,
        channel: row.channel,
        sessions: row.sessions,
        purchases: row.purchases,
        revenue: round(row.revenue),
      })),
    },
    products: topItems(insights.merchandising.top_products, 8).map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name || row.product_id,
      product_url: row.product_url || "",
      views: row.product_views,
      add_to_cart_events: row.add_to_cart_events,
      engagement_events: row.engagement_events,
    })),
    purchase_intent: intent
      ? {
          status: intent.status,
          average_score: round(intent.average_score),
          sessions_scored: intent.sessions_scored,
          visitors_scored: intent.visitors_scored,
          high_intent_sessions: intent.high_intent_sessions,
          medium_intent_sessions: intent.medium_intent_sessions,
          open_intent_sessions: intent.open_intent_sessions,
          converted_sessions: intent.converted_sessions,
          top_reasons: topItems(intent.reasons, 6),
          top_opportunities: topItems(intent.top_opportunities, 5).map((row) => ({
            session_id: row.session_id,
            visitor_id: row.visitor_id,
            score: round(row.score),
            tier: row.tier,
            reason: row.reason,
            product_view_count: row.product_view_count,
            add_to_cart_count: row.add_to_cart_count,
            checkout_start_count: row.checkout_start_count,
            cart_value_tnd: round(row.cart_value_tnd),
          })),
        }
      : { status: "collecting" },
    recommendations: {
      status: insights.recommendations.status,
      generated_at: insights.recommendations.generated_at,
      total_candidates: insights.recommendations.total_candidates,
      visitors: insights.recommendations.visitors,
      emailable_customers: insights.recommendations.emailable_customers,
      prepared_emails: insights.recommendations.prepared_emails,
      avg_score: round(insights.recommendations.avg_score),
      abandoned_cart_candidates: insights.recommendations.abandoned_cart_candidates,
      repeated_interest_candidates: insights.recommendations.repeated_interest_candidates,
      top_candidates: topItems(insights.recommendations.top_candidates, 6).map((row) => ({
        product_id: row.product_id,
        product_name: row.product_name,
        product_url: row.product_url,
        recommendation_type: row.recommendation_type,
        reason: row.reason,
        score: round(row.score),
        views: row.views,
        add_to_cart_events: row.add_to_cart_events,
      })),
    },
    data_quality: {
      note: insights.column_utilization.note,
      latest_analysis_run: insights.operations.analysis_runs[0]
        ? {
            status: insights.operations.analysis_runs[0].status,
            message: insights.operations.analysis_runs[0].message,
            updated_at: insights.operations.analysis_runs[0].updated_at,
          }
        : null,
    },
  }
}

export async function loadCopilotKnowledge() {
  if (knowledgeCache) return knowledgeCache

  try {
    const files = (await readdir(KNOWLEDGE_DIR)).filter((file) => file.endsWith(".md")).sort()
    const docs = await Promise.all(
      files.map(async (file) => {
        const body = await readFile(path.join(KNOWLEDGE_DIR, file), "utf8")
        return { file, body }
      })
    )

    knowledgeCache = {
      text: docs.map((doc) => `## ${doc.file}\n${doc.body}`).join("\n\n"),
      sources: docs.map((doc) => doc.file),
    }
  } catch {
    knowledgeCache = {
      text: [
        "BehaviourAI is a multi-tenant ecommerce behaviour intelligence platform.",
        "The copilot should use compact site metrics, explain business meaning, and guide users to the correct platform area.",
        "Smart Actions includes purchase intent scoring, product recommendations, and prepared outreach drafts.",
        "Current outreach mode is draft-only until consent, unsubscribe, cooldown, and provider rules are connected.",
      ].join("\n"),
      sources: ["inline_fallback"],
    }
  }

  return knowledgeCache
}

function buildSystemPrompt(knowledge: string, snapshot: SiteSnapshot, toolResults: CopilotToolResult[], toolError = "") {
  return [
    "You are the BehaviourAI Business Copilot.",
    "You answer using only the provided platform knowledge and site context snapshot.",
    "When TOOL RESULTS are present, use them for date-specific or precise count questions. Tool results override the general snapshot for that date range.",
    "Answer like a senior ecommerce growth analyst, not like a raw report generator.",
    "Be conversational, concise, practical, and honest about uncertainty.",
    "When the user asks 'what is', 'explain', 'what does this mean', or asks for beginner help, explain the concept first in simple terms, then use the site numbers as an example. Do not answer with numbers only.",
    "For metric-definition questions, use this shape: simple definition, why it matters, how to read the current site's numbers, next place to inspect.",
    "Adapt to the user's wording. If they ask what you think about the website, explain that you can judge business performance and customer behaviour from analytics, not visual design, unless they provide screenshots or ask for a UX review.",
    "Structure broad business answers as: quick verdict, why, risks, next best action.",
    "Do not always use long headings. Use short paragraphs for simple questions.",
    "For greetings or small talk, reply naturally and do not dump metrics.",
    "If data is missing, say what is missing and where the user should check. Do not overstate missing data as a tracker bug unless the context clearly proves it.",
    "Column coverage is field fill-rate, not proof that ecommerce events are underreported. Do not say add-to-cart or checkout events are underreported based only on column coverage.",
    "Do not invent metrics, customers, revenue, or model capabilities.",
    "Do not claim you queried raw SQL yourself. Say you used the platform's analytics tools or ClickHouse-backed metrics.",
    "Do not expose secrets, API keys, or unnecessary personal data.",
    "Current outreach is draft-only unless the context explicitly says otherwise.",
    "Only ask a follow-up question when it is truly needed. Usually end with a concrete action.",
    "",
    "PLATFORM KNOWLEDGE:",
    knowledge,
    "",
    "SITE CONTEXT SNAPSHOT:",
    JSON.stringify(snapshot, null, 2),
    "",
    "TOOL RESULTS:",
    toolResults.length ? JSON.stringify(toolResults, null, 2) : "No dynamic tool result was needed for this question.",
    toolError ? `\nTOOL WARNING:\n${toolError}` : "",
  ].join("\n")
}

function isLightGreeting(question: string) {
  return /^(hi|hello|hey|yo|salut|slt|bonjour|good morning|good afternoon|good evening)[\s!.?]*$/i.test(question.trim())
}

function shouldReturnSuggestedActions(question: string) {
  if (isLightGreeting(question)) return false
  const q = question.toLowerCase()
  return (
    q.includes("what should") ||
    q.includes("next") ||
    q.includes("action") ||
    q.includes("recommend") ||
    q.includes("cart") ||
    q.includes("abandon") ||
    q.includes("funnel") ||
    q.includes("intent") ||
    q.includes("score") ||
    q.includes("email") ||
    q.includes("where") ||
    q.includes("how")
  )
}

function isExplanationQuestion(question: string) {
  const q = question.toLowerCase()
  return (
    q.includes("what is") ||
    q.includes("what are") ||
    q.includes("what does") ||
    q.includes("explain") ||
    q.includes("meaning") ||
    q.includes("mean?") ||
    q.includes("for a beginner") ||
    q.includes("i don't understand") ||
    q.includes("i dont understand")
  )
}

function buildSuggestedActions(snapshot: SiteSnapshot): CopilotAction[] {
  const site = snapshot.site.site_id
  const base = `/app?site_id=${encodeURIComponent(site)}`
  const actions: CopilotAction[] = []

  if ((snapshot.purchase_intent.open_intent_sessions || 0) > 0) {
    actions.push({
      label: "Review Purchase Intent",
      href: `${base}&view=smart-intent`,
      reason: `${snapshot.purchase_intent.open_intent_sessions} open intent sessions need prioritization.`,
    })
  }

  if (snapshot.recommendations.prepared_emails > 0) {
    actions.push({
      label: "Review Recommendation Drafts",
      href: "/emails",
      reason: `${snapshot.recommendations.prepared_emails} recommendation email drafts are prepared.`,
    })
  }

  if (snapshot.business_overview.cart_sessions > snapshot.business_overview.purchase_sessions) {
    actions.push({
      label: "Inspect Funnels",
      href: `${base}&view=funnels`,
      reason: "Cart sessions are higher than purchase sessions, so the funnel may reveal drop-off.",
    })
  }

  actions.push({
    label: "Open Smart Actions",
    href: `${base}&view=smart-actions`,
    reason: "Smart Actions groups scoring, recommendations, and guarded outreach.",
  })

  return actions.slice(0, 4)
}

function getTool<T extends CopilotToolResult["name"]>(toolResults: CopilotToolResult[], name: T) {
  return toolResults.find((tool) => tool.name === name)
}

function mockAnswer(question: string, snapshot: SiteSnapshot, toolResults: CopilotToolResult[] = []) {
  const q = question.toLowerCase()
  const overview = snapshot.business_overview
  const intent = snapshot.purchase_intent
  const recommendations = snapshot.recommendations
  const lines: string[] = []
  const cartTool = getTool(toolResults, "cart_metrics")
  const salesTool = getTool(toolResults, "sales_metrics")
  const funnelTool = getTool(toolResults, "funnel_metrics")
  const productTool = getTool(toolResults, "product_metrics")
  const acquisitionTool = getTool(toolResults, "acquisition_metrics")
  const wantsExplanation = isExplanationQuestion(question)

  if (isLightGreeting(question)) {
    lines.push("Hey, I’m here. Ask me about sales, traffic, funnels, products, Smart Actions, tracker health, or what to do next for this site.")
  } else if (cartTool && (q.includes("cart") || q.includes("abandon") || q.includes("add to cart") || q.includes("panier"))) {
    lines.push(`Using the ClickHouse-backed cart tool for ${cartTool.date_range.label}:`)
    lines.push(
      `- Add-to-cart actions: ${cartTool.summary.add_to_cart_events}\n` +
        `- Unique add-to-cart sessions: ${cartTool.summary.add_to_cart_sessions}\n` +
        `- Broad abandoned cart sessions: ${cartTool.summary.abandoned_cart_sessions}\n` +
        `- Strict add-to-cart abandoned sessions: ${cartTool.summary.strict_add_to_cart_abandoned_sessions}`
    )
    lines.push("Reminder: these are tracker sessions/events, not native PrestaShop cart IDs, unless we add backend cart-id tracking.")
  } else if (salesTool && (q.includes("sale") || q.includes("revenue") || q.includes("purchase") || q.includes("order"))) {
    lines.push(`Using the ClickHouse-backed sales tool for ${salesTool.date_range.label}:`)
    lines.push(
      `- Purchases: ${salesTool.summary.purchase_events}\n` +
        `- Revenue: ${salesTool.summary.revenue_tnd} TND\n` +
        `- Cancelled orders: ${salesTool.summary.cancelled_orders}\n` +
        `- Net revenue estimate: ${salesTool.summary.net_revenue_tnd} TND`
    )
  } else if (funnelTool && (q.includes("funnel") || q.includes("conversion") || q.includes("checkout"))) {
    if (wantsExplanation) {
      lines.push("A conversion funnel is the path visitors take before becoming buyers. In ecommerce, it usually means: visit the site, view products, add something to cart, start checkout, then complete a purchase.")
      lines.push("It matters because it shows where people are dropping off. If many people add to cart but few purchase, the problem may be price, delivery, payment, trust, or checkout friction.")
      lines.push(`For ${funnelTool.date_range.label}, your funnel has ${funnelTool.summary.sessions} sessions, ${funnelTool.summary.add_to_cart_sessions} add-to-cart sessions, ${funnelTool.summary.checkout_sessions} checkout sessions, and ${funnelTool.summary.purchase_sessions} purchase sessions.`)
      lines.push(`That means the overall conversion rate is ${funnelTool.summary.session_to_purchase_rate_pct}%. Cart-to-purchase is ${funnelTool.summary.cart_to_purchase_rate_pct}%, and checkout-to-purchase is ${funnelTool.summary.checkout_to_purchase_rate_pct}%.`)
      lines.push("In simple terms: the funnel tells you not only how many people bought, but where the others stopped. The next place to inspect is Funnels, then Smart Actions for high-intent visitors who did not buy.")
    } else {
      lines.push(`For ${funnelTool.date_range.label}, the funnel has ${funnelTool.summary.sessions} sessions, ${funnelTool.summary.add_to_cart_sessions} add-to-cart sessions, ${funnelTool.summary.checkout_sessions} checkout sessions, and ${funnelTool.summary.purchase_sessions} purchase sessions.`)
      lines.push(`Conversion rate is ${funnelTool.summary.session_to_purchase_rate_pct}%, cart-to-purchase is ${funnelTool.summary.cart_to_purchase_rate_pct}%, and checkout-to-purchase is ${funnelTool.summary.checkout_to_purchase_rate_pct}%.`)
    }
  } else if (productTool && (q.includes("product") || q.includes("recommend"))) {
    const first = productTool.rows[0]
    lines.push(`For ${productTool.date_range.label}, I found ${productTool.summary.products_returned} top product signals.`)
    if (first) {
      lines.push(`Top signal: ${first.product_name || first.product_id}, with ${first.product_views} views and ${first.add_to_cart_events} add-to-cart actions.`)
    }
  } else if (acquisitionTool && (q.includes("traffic") || q.includes("source") || q.includes("campaign") || q.includes("referrer"))) {
    const first = acquisitionTool.rows[0]
    lines.push(`For ${acquisitionTool.date_range.label}, I checked acquisition sources from ClickHouse-backed metrics.`)
    if (first) {
      lines.push(`Top source: ${first.source} (${first.source_type}), with ${first.sessions} sessions, ${first.purchases} purchases, and ${first.revenue_tnd} TND revenue.`)
    }
  } else if (q.includes("website") || q.includes("site") || q.includes("think")) {
    lines.push(`From the analytics side, this website has real commercial signal: ${overview.sessions} sessions, ${overview.purchase_sessions} purchase sessions, ${overview.revenue_tnd} TND revenue, and a ${overview.conversion_rate_pct}% conversion rate in the current window.`)
    lines.push(`My quick take: acquisition and product interest are working, but the biggest business opportunity is turning more cart and checkout activity into completed orders.`)
    lines.push(`Next best action: open Funnels to find the biggest drop-off, then use Smart Actions to review high-intent sessions and prepared recommendation drafts.`)
  } else if (q.includes("cart") || q.includes("abandon")) {
    lines.push(`Cart activity is a clear action area: ${overview.cart_sessions} sessions added to cart, while ${overview.purchase_sessions} sessions purchased.`)
    lines.push(`Start in Funnels to inspect the drop-off, then use Smart Actions to review high-intent sessions and recommendation drafts.`)
  } else if (q.includes("recommend")) {
    lines.push(`The recommendation engine has ${recommendations.total_candidates} candidates across ${recommendations.visitors} visitors, with ${recommendations.prepared_emails} prepared email drafts.`)
    lines.push(`Current sending mode is draft-only, so review the outbox before connecting a real provider.`)
  } else if (q.includes("intent") || q.includes("score")) {
    lines.push(`Purchase Intent is ${intent.status}. The average score is ${intent.average_score ?? 0}, with ${intent.open_intent_sessions ?? 0} open intent sessions.`)
    lines.push(`Use the Purchase Intent page to inspect why each visitor received a score.`)
  } else if (q.includes("business") || q.includes("doing") || q.includes("performance")) {
    lines.push(`For this window, the site has ${overview.sessions} sessions, ${overview.visitors} visitors, ${overview.revenue_tnd} TND revenue, and a ${overview.conversion_rate_pct}% conversion rate.`)
    lines.push(`The main next step is to focus on Smart Actions if you want recoverable opportunities, or Funnels if you want to understand conversion drop-off.`)
  } else {
    lines.push(`I can help explain this site using the current analytics snapshot: ${overview.sessions} sessions, ${overview.purchase_sessions} purchase sessions, ${overview.revenue_tnd} TND revenue, and ${recommendations.prepared_emails} prepared recommendation drafts.`)
    lines.push(`A good next step is Smart Actions, where scoring, recommendations, and guarded outreach are grouped.`)
  }

  lines.push(`Data as of ${snapshot.data_as_of}.`)
  return lines.join("\n\n")
}

function fallbackDashboardInsights(snapshot: SiteSnapshot): Pick<CopilotDashboardInsights, "alert" | "recommendations"> {
  const overview = snapshot.business_overview
  const products = snapshot.products
  const topProduct = products[0]
  const topChannel = snapshot.acquisition.channels[0]
  const topIntent = snapshot.purchase_intent.top_opportunities?.[0]
  const conversionGap = Math.max(overview.cart_sessions - overview.purchase_sessions, 0)

  const alert: ProductInsight = {
    id: "fallback-funnel",
    type: conversionGap > 0 ? "warning" : "info",
    title: conversionGap > 0 ? "Cart activity is not fully converting" : "Keep watching conversion quality",
    description: conversionGap > 0
      ? `${conversionGap} cart sessions did not become purchase sessions in the current window. Review the funnel and recovery drafts before increasing outreach.`
      : "The current snapshot has limited cart leakage. Keep monitoring products, traffic sources, and checkout status changes.",
    metric: {
      label: "Cart gap",
      value: `${conversionGap} sessions`,
    },
  }

  const recommendations: ProductInsight[] = [
    topProduct
      ? {
          id: "fallback-product",
          type: "opportunity",
          title: "Prioritize the strongest product signal",
          description: `${topProduct.product_name || topProduct.product_id} has ${topProduct.views} views and ${topProduct.add_to_cart_events} add-to-cart actions. Use it in product follow-up and merchandising tests.`,
          metric: { label: "Engagement", value: `${topProduct.engagement_events} events` },
        }
      : null,
    topChannel
      ? {
          id: "fallback-channel",
          type: "info",
          title: "Protect the strongest acquisition channel",
          description: `${topChannel.channel} currently brings ${topChannel.sessions} sessions and ${topChannel.purchases} purchases. Compare it against buyer campaigns before changing spend.`,
          metric: { label: "Revenue", value: `${topChannel.revenue} TND` },
        }
      : null,
    topIntent
      ? {
          id: "fallback-intent",
          type: "warning",
          title: "Review high-intent visitors",
          description: `${snapshot.purchase_intent.open_intent_sessions || 0} open intent sessions are available. Start with the highest scored sessions and check whether outreach drafts are prepared.`,
          metric: { label: "Top score", value: `${topIntent.score}` },
        }
      : {
          id: "fallback-actions",
          type: "info",
          title: "Use Smart Actions as the operating queue",
          description: `The recommendation engine has ${snapshot.recommendations.total_candidates} candidates and ${snapshot.recommendations.prepared_emails} prepared drafts for this site.`,
          metric: { label: "Drafts", value: `${snapshot.recommendations.prepared_emails}` },
        },
  ].filter(Boolean) as ProductInsight[]

  return { alert, recommendations: recommendations.slice(0, 3) }
}

function parseJsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start < 0 || end < start) {
    throw new Error("AI response did not contain a JSON object.")
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown
}

function safeInsightType(value: unknown): ProductInsight["type"] {
  return value === "opportunity" || value === "warning" || value === "success" || value === "info" ? value : "info"
}

function cleanShortText(value: unknown, fallback: string, maxLength: number) {
  const text = String(value || "").replace(/\s+/g, " ").trim()
  return (text || fallback).slice(0, maxLength)
}

function sanitizeInsight(value: unknown, fallback: ProductInsight, id: string): ProductInsight {
  if (!value || typeof value !== "object") {
    return { ...fallback, id }
  }
  const raw = value as Record<string, unknown>
  const metric = raw.metric && typeof raw.metric === "object" ? raw.metric as Record<string, unknown> : null

  return {
    id,
    type: safeInsightType(raw.type),
    title: cleanShortText(raw.title, fallback.title, 90),
    description: cleanShortText(raw.description, fallback.description, 260),
    metric: metric
      ? {
          label: cleanShortText(metric.label, fallback.metric?.label || "Signal", 40),
          value: cleanShortText(metric.value, fallback.metric?.value || "", 40),
        }
      : fallback.metric,
  }
}

async function callOpenAICompatibleDashboardInsights({
  knowledge,
  snapshot,
}: {
  knowledge: string
  snapshot: SiteSnapshot
}) {
  const apiKey = process.env.COPILOT_API_KEY
  const model = process.env.COPILOT_MODEL
  const baseUrl = (process.env.COPILOT_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")

  if (!apiKey || !model) {
    return null
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: [
            "You generate live dashboard suggestion cards for BehaviourAI.",
            "Use only the provided site snapshot and platform knowledge.",
            "Return only valid JSON. No markdown, no commentary.",
            "Do not invent metrics, revenue, customer names, model status, or products.",
            "Do not translate product names or campaign/referrer names.",
            "Keep each title under 90 characters and each description under 260 characters.",
            "Make the suggestions practical for a store owner.",
            "",
            "JSON schema:",
            JSON.stringify({
              alert: {
                type: "warning|opportunity|info|success",
                title: "main urgent insight",
                description: "why it matters and what to check next",
                metric: { label: "short metric label", value: "short metric value" },
              },
              recommendations: [
                {
                  type: "warning|opportunity|info|success",
                  title: "suggestion title",
                  description: "business recommendation",
                  metric: { label: "short metric label", value: "short metric value" },
                },
              ],
            }),
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "PLATFORM KNOWLEDGE:",
            knowledge,
            "",
            "SITE SNAPSHOT:",
            JSON.stringify(snapshot, null, 2),
            "",
            "Generate one alert and exactly three recommendation cards.",
          ].join("\n"),
        },
      ],
      temperature: 0.25,
      max_tokens: 900,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Copilot provider failed: ${response.status} ${detail}`)
  }

  const payload = await response.json()
  return String(payload.choices?.[0]?.message?.content || "").trim()
}

export async function generateDashboardAiInsights({
  insights,
}: {
  insights: BehaviorInsights
}): Promise<CopilotDashboardInsights> {
  const snapshot = buildSiteSnapshot(insights)
  const knowledge = await loadCopilotKnowledge()
  const fallback = fallbackDashboardInsights(snapshot)
  const provider = process.env.COPILOT_PROVIDER || "mock"

  if (provider === "openai-compatible") {
    try {
      const generated = await callOpenAICompatibleDashboardInsights({
        knowledge: knowledge.text,
        snapshot,
      })
      if (generated) {
        const parsed = parseJsonObject(generated) as Record<string, unknown>
        const rawRecommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : []
        const recommendations = rawRecommendations
          .slice(0, 3)
          .map((item, index) => sanitizeInsight(item, fallback.recommendations[index] || fallback.alert, `ai-rec-${index}`))

        while (recommendations.length < 3 && fallback.recommendations[recommendations.length]) {
          recommendations.push({
            ...fallback.recommendations[recommendations.length],
            id: `fallback-rec-${recommendations.length}`,
          })
        }

        return {
          alert: sanitizeInsight(parsed.alert, fallback.alert, "ai-alert"),
          recommendations,
          mode: "llm",
          model: process.env.COPILOT_MODEL || "configured-model",
          data_as_of: snapshot.data_as_of,
          sources: knowledge.sources,
        }
      }
    } catch (error) {
      return {
        ...fallback,
        mode: "mock",
        model: "rules-mock/provider-fallback",
        data_as_of: snapshot.data_as_of,
        sources: knowledge.sources,
        error: friendlyProviderError(error),
      }
    }
  }

  return {
    ...fallback,
    mode: "mock",
    model: "rules-mock",
    data_as_of: snapshot.data_as_of,
    sources: knowledge.sources,
  }
}

function friendlyProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  if (message.includes("insufficient_quota") || message.toLowerCase().includes("quota")) {
    return "the configured AI provider has no available quota"
  }
  if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
    return "the configured AI provider rejected the API key"
  }
  if (message.includes("404") || message.toLowerCase().includes("model")) {
    return "the configured AI model is not available"
  }
  return "the configured AI provider is temporarily unavailable"
}

async function callOpenAICompatible({
  question,
  history,
  knowledge,
  snapshot,
  toolResults,
  toolError,
}: {
  question: string
  history: CopilotMessage[]
  knowledge: string
  snapshot: SiteSnapshot
  toolResults: CopilotToolResult[]
  toolError?: string
}) {
  const apiKey = process.env.COPILOT_API_KEY
  const model = process.env.COPILOT_MODEL
  const baseUrl = (process.env.COPILOT_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")

  if (!apiKey || !model) {
    return null
  }

  const messages = [
    { role: "system", content: buildSystemPrompt(knowledge, snapshot, toolResults, toolError) },
    ...history.slice(-8).map((message) => ({ role: message.role, content: message.content })),
    { role: "user", content: question },
  ]

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 700,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Copilot provider failed: ${response.status} ${detail}`)
  }

  const payload = await response.json()
  return String(payload.choices?.[0]?.message?.content || "").trim()
}

export async function answerCopilotQuestion({
  question,
  history,
  insights,
}: {
  question: string
  history: CopilotMessage[]
  insights: BehaviorInsights
}): Promise<CopilotResponse> {
  const cleanQuestion = question.trim().slice(0, 2000)
  const snapshot = buildSiteSnapshot(insights)
  const knowledge = await loadCopilotKnowledge()

  if (isLightGreeting(cleanQuestion)) {
    return {
      answer: mockAnswer(cleanQuestion, snapshot),
      mode: "mock",
      model: "rules-smalltalk",
      data_as_of: snapshot.data_as_of,
      suggested_actions: [],
      sources: knowledge.sources,
      tools_used: [],
    }
  }

  let toolResults: CopilotToolResult[] = []
  let toolError = ""
  try {
    toolResults = await runCopilotTools({
      question: cleanQuestion,
      siteId: snapshot.site.site_id,
      timezone: snapshot.site.timezone || "UTC",
    })
  } catch (error) {
    toolError = error instanceof Error ? error.message : "Dynamic analytics tools were unavailable."
  }

  const provider = process.env.COPILOT_PROVIDER || "mock"
  let mode: CopilotResponse["mode"] = "mock"
  let model = "rules-mock"
  let answer = ""
  let providerError = ""

  if (provider === "openai-compatible") {
    try {
      const generated = await callOpenAICompatible({
        question: cleanQuestion,
        history,
        knowledge: knowledge.text,
        snapshot,
        toolResults,
        toolError,
      })
      if (generated) {
        answer = generated
        mode = "llm"
        model = process.env.COPILOT_MODEL || "configured-model"
      }
    } catch (error) {
      providerError = friendlyProviderError(error)
    }
  }

  if (!answer) {
    answer = mockAnswer(cleanQuestion, snapshot, toolResults)
    if (providerError) {
      answer = `Real AI mode is configured, but ${providerError}. I can still answer from the local analytics snapshot for now.\n\n${answer}`
      model = "rules-mock/provider-fallback"
    }
    if (toolError) {
      answer = `${answer}\n\nNote: dynamic analytics tools were unavailable for this answer, so this may use the dashboard snapshot instead of a fresh date-specific query.`
    }
  }

  return {
    answer,
    mode,
    model,
    data_as_of: snapshot.data_as_of,
    suggested_actions: shouldReturnSuggestedActions(cleanQuestion) ? buildSuggestedActions(snapshot) : [],
    sources: [...knowledge.sources, ...toolResults.map((tool) => `tool:${tool.name}`)],
    tools_used: toolResults.map((tool) => tool.name),
  }
}
