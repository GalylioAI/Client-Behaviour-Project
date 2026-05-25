import { clickhouseQuery, num, sqlString, str } from "@/lib/clickhouse"

export type CopilotToolName =
  | "cart_metrics"
  | "sales_metrics"
  | "funnel_metrics"
  | "product_metrics"
  | "acquisition_metrics"
  | "recent_events"

export interface CopilotToolResult {
  name: CopilotToolName
  title: string
  site_id: string
  date_range: {
    start: string
    end: string
    timezone: string
    label: string
  }
  summary: Record<string, number | string | null>
  rows: Array<Record<string, number | string | null>>
  notes: string[]
}

type DateRange = CopilotToolResult["date_range"]

const monthNumbers: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function ymdInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = Number(parts.find((part) => part.type === "year")?.value || date.getUTCFullYear())
  const month = Number(parts.find((part) => part.type === "month")?.value || date.getUTCMonth() + 1)
  const day = Number(parts.find((part) => part.type === "day")?.value || date.getUTCDate())
  return ymd(year, month, day)
}

function addDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0))
  return ymd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function compareYmd(a: string, b: string) {
  return a.localeCompare(b)
}

function normalizeYear(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (parsed < 100) return 2000 + parsed
  return parsed
}

function uniqueDates(values: string[]) {
  return Array.from(new Set(values)).filter(Boolean).sort(compareYmd)
}

function extractExplicitDates(question: string, currentYear: number, currentMonth: number) {
  const dates: string[] = []
  const text = question.toLowerCase()

  for (const match of text.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)) {
    dates.push(ymd(Number(match[1]), Number(match[2]), Number(match[3])))
  }

  for (const match of text.matchAll(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}|\d{2}))?\b/g)) {
    const day = Number(match[1])
    const month = Number(match[2])
    const year = normalizeYear(match[3], currentYear)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      dates.push(ymd(year, month, day))
    }
  }

  for (const match of text.matchAll(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,\s*(20\d{2}))?\b/g)) {
    const month = monthNumbers[match[1]]
    const day = Number(match[2])
    const year = normalizeYear(match[3], currentYear)
    if (month && day >= 1 && day <= 31) {
      dates.push(ymd(year, month, day))
    }
  }

  for (const match of text.matchAll(/\bday\s+(\d{1,2})\b/g)) {
    const day = Number(match[1])
    if (day >= 1 && day <= 31) {
      dates.push(ymd(currentYear, currentMonth, day))
    }
  }

  return uniqueDates(dates)
}

export function resolveCopilotDateRange(question: string, timezone: string): DateRange {
  const today = ymdInTimezone(new Date(), timezone)
  const [currentYear, currentMonth] = today.split("-").map(Number)
  const q = question.toLowerCase()
  const explicitDates = extractExplicitDates(q, currentYear, currentMonth)

  if (explicitDates.length >= 2) {
    return {
      start: explicitDates[0],
      end: explicitDates[explicitDates.length - 1],
      timezone,
      label: `${explicitDates[0]} to ${explicitDates[explicitDates.length - 1]}`,
    }
  }

  if (explicitDates.length === 1) {
    return {
      start: explicitDates[0],
      end: explicitDates[0],
      timezone,
      label: explicitDates[0],
    }
  }

  if (q.includes("yesterday") && q.includes("today")) {
    const yesterday = addDays(today, -1)
    return { start: yesterday, end: today, timezone, label: "yesterday and today" }
  }

  if (q.includes("yesterday")) {
    const yesterday = addDays(today, -1)
    return { start: yesterday, end: yesterday, timezone, label: "yesterday" }
  }

  if (q.includes("today")) {
    return { start: today, end: today, timezone, label: "today" }
  }

  const lastDays = q.match(/\blast\s+(\d{1,2})\s+days?\b/)
  if (lastDays) {
    const days = Math.min(Math.max(Number(lastDays[1]), 1), 30)
    return { start: addDays(today, -(days - 1)), end: today, timezone, label: `last ${days} days` }
  }

  if (q.includes("this week")) {
    return { start: addDays(today, -6), end: today, timezone, label: "this week" }
  }

  return { start: addDays(today, -6), end: today, timezone, label: "last 7 days" }
}

function eventDateFilter(range: DateRange) {
  const timezone = sqlString(range.timezone || "UTC")
  return `toDate(toTimeZone(event_timestamp, ${timezone})) BETWEEN toDate(${sqlString(range.start)}) AND toDate(${sqlString(range.end)})`
}

function receivedDateFilter(range: DateRange) {
  const timezone = sqlString(range.timezone || "UTC")
  return `toDate(toTimeZone(received_at, ${timezone})) BETWEEN toDate(${sqlString(range.start)}) AND toDate(${sqlString(range.end)})`
}

function shouldUse(question: string, terms: string[]) {
  const q = question.toLowerCase()
  return terms.some((term) => q.includes(term))
}

function baseResult(
  name: CopilotToolName,
  title: string,
  siteId: string,
  range: DateRange,
  summary: Record<string, number | string | null>,
  rows: Array<Record<string, number | string | null>>,
  notes: string[] = []
): CopilotToolResult {
  return { name, title, site_id: siteId, date_range: range, summary, rows, notes }
}

async function getCartMetrics(siteId: string, range: DateRange) {
  const quotedSite = sqlString(siteId)
  const filter = eventDateFilter(range)
  const rows = await clickhouseQuery<Record<string, unknown>>(`
    WITH daily_sessions AS (
      SELECT
        toDate(toTimeZone(event_timestamp, ${sqlString(range.timezone || "UTC")})) AS day,
        session_id,
        countIf(event_name = 'add_to_cart') AS atc_events,
        countIf(event_name = 'cart_view') AS cv_events,
        countIf(event_name = 'cart_update') AS cart_update_events,
        countIf(event_name = 'checkout_start') AS checkout_events,
        countIf(event_name = 'purchase_completed') AS p_events
      FROM tracer.ecommerce_events
      WHERE site_id = ${quotedSite}
        AND ${filter}
      GROUP BY day, session_id
    )
    SELECT
      day,
      sum(atc_events) AS add_to_cart_events,
      countIf(atc_events > 0) AS add_to_cart_sessions,
      sum(cv_events) AS cart_view_events,
      countIf(cv_events > 0) AS cart_view_sessions,
      sum(cart_update_events) AS cart_update_events,
      countIf(checkout_events > 0) AS checkout_sessions,
      sum(p_events) AS purchase_events,
      countIf((atc_events > 0 OR cv_events > 0) AND p_events = 0) AS abandoned_cart_sessions,
      countIf(atc_events > 0 AND p_events = 0) AS strict_add_to_cart_abandoned_sessions
    FROM daily_sessions
    GROUP BY day
    ORDER BY day
  `)

  const totals = rows.reduce(
    (acc, row) => ({
      add_to_cart_events: acc.add_to_cart_events + num(row.add_to_cart_events),
      add_to_cart_sessions: acc.add_to_cart_sessions + num(row.add_to_cart_sessions),
      cart_view_events: acc.cart_view_events + num(row.cart_view_events),
      cart_view_sessions: acc.cart_view_sessions + num(row.cart_view_sessions),
      cart_update_events: acc.cart_update_events + num(row.cart_update_events),
      checkout_sessions: acc.checkout_sessions + num(row.checkout_sessions),
      purchase_events: acc.purchase_events + num(row.purchase_events),
      abandoned_cart_sessions: acc.abandoned_cart_sessions + num(row.abandoned_cart_sessions),
      strict_add_to_cart_abandoned_sessions:
        acc.strict_add_to_cart_abandoned_sessions + num(row.strict_add_to_cart_abandoned_sessions),
    }),
    {
      add_to_cart_events: 0,
      add_to_cart_sessions: 0,
      cart_view_events: 0,
      cart_view_sessions: 0,
      cart_update_events: 0,
      checkout_sessions: 0,
      purchase_events: 0,
      abandoned_cart_sessions: 0,
      strict_add_to_cart_abandoned_sessions: 0,
    }
  )

  return baseResult(
    "cart_metrics",
    "Cart And Abandonment Metrics",
    siteId,
    range,
    totals,
    rows.map((row) => ({
      day: str(row.day),
      add_to_cart_events: num(row.add_to_cart_events),
      add_to_cart_sessions: num(row.add_to_cart_sessions),
      cart_view_events: num(row.cart_view_events),
      cart_view_sessions: num(row.cart_view_sessions),
      cart_update_events: num(row.cart_update_events),
      checkout_sessions: num(row.checkout_sessions),
      purchase_events: num(row.purchase_events),
      abandoned_cart_sessions: num(row.abandoned_cart_sessions),
      strict_add_to_cart_abandoned_sessions: num(row.strict_add_to_cart_abandoned_sessions),
    })),
    [
      "This tool counts tracker sessions and browser events, not native PrestaShop cart rows.",
      "Use add_to_cart_events for actions, add_to_cart_sessions for unique visits with cart intent, and abandoned_cart_sessions for sessions with cart activity but no purchase.",
    ]
  )
}

async function getSalesMetrics(siteId: string, range: DateRange) {
  const quotedSite = sqlString(siteId)
  const filter = eventDateFilter(range)
  const rows = await clickhouseQuery<Record<string, unknown>>(`
    SELECT
      toDate(toTimeZone(event_timestamp, ${sqlString(range.timezone || "UTC")})) AS day,
      countIf(event_name = 'purchase_completed') AS purchase_events,
      uniqExactIf(JSONExtractString(properties, 'order_id'), event_name = 'purchase_completed') AS unique_orders,
      uniqExactIf(JSONExtractString(properties, 'cart_id'), event_name = 'purchase_completed') AS purchased_cart_ids,
      round(sumIf(JSONExtractFloat(properties, 'order_total'), event_name = 'purchase_completed'), 2) AS revenue_tnd,
      countIf(event_name = 'order_cancelled') AS cancelled_orders,
      round(sumIf(JSONExtractFloat(properties, 'order_total'), event_name = 'order_cancelled'), 2) AS cancelled_revenue_tnd,
      countIf(event_name = 'order_refunded') AS refunded_orders,
      countIf(event_name = 'order_failed') AS failed_orders
    FROM tracer.ecommerce_events
    WHERE site_id = ${quotedSite}
      AND ${filter}
      AND event_name IN ('purchase_completed', 'order_cancelled', 'order_refunded', 'order_failed')
    GROUP BY day
    ORDER BY day
  `)

  const totals = rows.reduce(
    (acc, row) => ({
      purchase_events: acc.purchase_events + num(row.purchase_events),
      unique_orders: acc.unique_orders + num(row.unique_orders),
      purchased_cart_ids: acc.purchased_cart_ids + num(row.purchased_cart_ids),
      revenue_tnd: acc.revenue_tnd + num(row.revenue_tnd),
      cancelled_orders: acc.cancelled_orders + num(row.cancelled_orders),
      cancelled_revenue_tnd: acc.cancelled_revenue_tnd + num(row.cancelled_revenue_tnd),
      refunded_orders: acc.refunded_orders + num(row.refunded_orders),
      failed_orders: acc.failed_orders + num(row.failed_orders),
    }),
    {
      purchase_events: 0,
      unique_orders: 0,
      purchased_cart_ids: 0,
      revenue_tnd: 0,
      cancelled_orders: 0,
      cancelled_revenue_tnd: 0,
      refunded_orders: 0,
      failed_orders: 0,
    }
  )

  return baseResult(
    "sales_metrics",
    "Sales Metrics",
    siteId,
    range,
    {
      ...totals,
      net_revenue_tnd: Number((totals.revenue_tnd - totals.cancelled_revenue_tnd).toFixed(2)),
      average_order_value_tnd:
        totals.purchase_events > 0 ? Number((totals.revenue_tnd / totals.purchase_events).toFixed(2)) : null,
    },
    rows.map((row) => ({
      day: str(row.day),
      purchase_events: num(row.purchase_events),
      unique_orders: num(row.unique_orders),
      purchased_cart_ids: num(row.purchased_cart_ids),
      revenue_tnd: num(row.revenue_tnd),
      cancelled_orders: num(row.cancelled_orders),
      cancelled_revenue_tnd: num(row.cancelled_revenue_tnd),
      refunded_orders: num(row.refunded_orders),
      failed_orders: num(row.failed_orders),
    })),
    ["Revenue is based on captured purchase_completed events; net revenue subtracts cancellation events observed in the same selected range."]
  )
}

async function getFunnelMetrics(siteId: string, range: DateRange) {
  const quotedSite = sqlString(siteId)
  const filter = eventDateFilter(range)
  const rows = await clickhouseQuery<Record<string, unknown>>(`
    WITH per_session AS (
      SELECT
        session_id,
        count() AS events,
        countIf(event_name = 'product_view') AS product_views,
        countIf(event_name = 'add_to_cart') AS add_to_cart_events,
        countIf(event_name = 'checkout_start') AS checkout_events,
        countIf(event_name = 'purchase_completed') AS purchase_events
      FROM tracer.ecommerce_events
      WHERE site_id = ${quotedSite}
        AND ${filter}
      GROUP BY session_id
    )
    SELECT
      count() AS sessions,
      countIf(product_views > 0) AS product_view_sessions,
      countIf(add_to_cart_events > 0) AS add_to_cart_sessions,
      countIf(checkout_events > 0) AS checkout_sessions,
      countIf(purchase_events > 0) AS purchase_sessions,
      round(100 * countIf(purchase_events > 0) / greatest(count(), 1), 2) AS session_to_purchase_rate_pct,
      round(100 * countIf(purchase_events > 0) / greatest(countIf(add_to_cart_events > 0), 1), 2) AS cart_to_purchase_rate_pct,
      round(100 * countIf(purchase_events > 0) / greatest(countIf(checkout_events > 0), 1), 2) AS checkout_to_purchase_rate_pct
    FROM per_session
  `)
  const row = rows[0] || {}
  const summary = {
    sessions: num(row.sessions),
    product_view_sessions: num(row.product_view_sessions),
    add_to_cart_sessions: num(row.add_to_cart_sessions),
    checkout_sessions: num(row.checkout_sessions),
    purchase_sessions: num(row.purchase_sessions),
    session_to_purchase_rate_pct: num(row.session_to_purchase_rate_pct),
    cart_to_purchase_rate_pct: num(row.cart_to_purchase_rate_pct),
    checkout_to_purchase_rate_pct: num(row.checkout_to_purchase_rate_pct),
  }

  return baseResult("funnel_metrics", "Funnel Metrics", siteId, range, summary, [summary])
}

async function getProductMetrics(siteId: string, range: DateRange) {
  const quotedSite = sqlString(siteId)
  const filter = eventDateFilter(range)
  const rows = await clickhouseQuery<Record<string, unknown>>(`
    SELECT
      JSONExtractString(properties, 'product_id') AS product_id,
      argMaxIf(JSONExtractString(properties, 'product_name'), event_timestamp, JSONExtractString(properties, 'product_name') != '') AS product_name,
      argMaxIf(page_url, event_timestamp, page_url != '') AS product_url,
      countIf(event_name = 'product_view') AS product_views,
      countIf(event_name = 'add_to_cart') AS add_to_cart_events,
      uniqExactIf(session_id, event_name = 'product_view') AS view_sessions,
      uniqExactIf(session_id, event_name = 'add_to_cart') AS add_to_cart_sessions
    FROM tracer.ecommerce_events
    WHERE site_id = ${quotedSite}
      AND ${filter}
      AND event_name IN ('product_view', 'add_to_cart')
      AND JSONExtractString(properties, 'product_id') != ''
    GROUP BY product_id
    ORDER BY add_to_cart_events DESC, product_views DESC
    LIMIT 8
  `)

  return baseResult(
    "product_metrics",
    "Top Product Signals",
    siteId,
    range,
    { products_returned: rows.length },
    rows.map((row) => ({
      product_id: str(row.product_id),
      product_name: str(row.product_name, `Product ${str(row.product_id)}`),
      product_url: str(row.product_url),
      product_views: num(row.product_views),
      add_to_cart_events: num(row.add_to_cart_events),
      view_sessions: num(row.view_sessions),
      add_to_cart_sessions: num(row.add_to_cart_sessions),
    }))
  )
}

async function getAcquisitionMetrics(siteId: string, range: DateRange) {
  const quotedSite = sqlString(siteId)
  const filter = eventDateFilter(range)
  const rows = await clickhouseQuery<Record<string, unknown>>(`
    WITH per_session AS (
      SELECT
        session_id,
        anyIf(referrer_url, referrer_url != '') AS referrer_url,
        anyIf(page_url, event_name = 'session_start') AS first_page_url,
        countIf(event_name = 'purchase_completed') AS purchases,
        sumIf(JSONExtractFloat(properties, 'order_total'), event_name = 'purchase_completed') AS revenue
      FROM tracer.ecommerce_events
      WHERE site_id = ${quotedSite}
        AND ${filter}
      GROUP BY session_id
    )
    SELECT
      if(extractURLParameter(first_page_url, 'utm_source') != '', extractURLParameter(first_page_url, 'utm_source'), if(referrer_url = '', 'Direct', domain(referrer_url))) AS source,
      if(extractURLParameter(first_page_url, 'utm_source') != '', 'Campaign', if(referrer_url = '', 'Direct', 'Referrer')) AS source_type,
      count() AS sessions,
      countIf(purchases > 0) AS purchase_sessions,
      sum(purchases) AS purchases,
      round(sum(revenue), 2) AS revenue_tnd
    FROM per_session
    GROUP BY source, source_type
    ORDER BY sessions DESC, revenue_tnd DESC
    LIMIT 8
  `)

  return baseResult(
    "acquisition_metrics",
    "Acquisition Metrics",
    siteId,
    range,
    { sources_returned: rows.length },
    rows.map((row) => ({
      source: str(row.source, "Direct"),
      source_type: str(row.source_type),
      sessions: num(row.sessions),
      purchase_sessions: num(row.purchase_sessions),
      purchases: num(row.purchases),
      revenue_tnd: num(row.revenue_tnd),
    })),
    ["Campaign source uses utm_source when present; otherwise this tool falls back to browser referrer or Direct."]
  )
}

async function getRecentEvents(siteId: string, range: DateRange) {
  const quotedSite = sqlString(siteId)
  const filter = receivedDateFilter(range)
  const rows = await clickhouseQuery<Record<string, unknown>>(`
    SELECT
      received_at,
      event_name,
      source,
      platform,
      session_id,
      page_url
    FROM tracer.ecommerce_events
    WHERE site_id = ${quotedSite}
      AND ${filter}
    ORDER BY received_at DESC
    LIMIT 10
  `)

  return baseResult(
    "recent_events",
    "Recent Accepted Events",
    siteId,
    range,
    { events_returned: rows.length },
    rows.map((row) => ({
      received_at: str(row.received_at),
      event_name: str(row.event_name),
      source: str(row.source),
      platform: str(row.platform),
      session_id: str(row.session_id).slice(0, 12),
      page_url: str(row.page_url).slice(0, 160),
    })),
    ["Session IDs are shortened in the assistant context to avoid exposing unnecessary identifiers."]
  )
}

export function selectCopilotToolNames(question: string): CopilotToolName[] {
  const names = new Set<CopilotToolName>()
  const q = question.toLowerCase()

  if (shouldUse(q, ["cart", "abandon", "add to cart", "add-to-cart", "panier", "checkout"])) {
    names.add("cart_metrics")
    names.add("funnel_metrics")
  }
  if (shouldUse(q, ["sale", "sales", "revenue", "purchase", "order", "aov", "money", "cancel", "refund"])) {
    names.add("sales_metrics")
  }
  if (shouldUse(q, ["funnel", "conversion", "drop", "checkout", "transform"])) {
    names.add("funnel_metrics")
  }
  if (shouldUse(q, ["product", "item", "recommend", "viewed", "added"])) {
    names.add("product_metrics")
  }
  if (shouldUse(q, ["referrer", "referral", "campaign", "utm", "source", "traffic", "primini", "google", "facebook"])) {
    names.add("acquisition_metrics")
  }
  if (shouldUse(q, ["live", "recent", "logs", "received", "arriving", "tracker"])) {
    names.add("recent_events")
  }

  if (!names.size && shouldUse(q, ["today", "yesterday", "last ", "day ", "how many", "count", "compare"])) {
    names.add("sales_metrics")
    names.add("cart_metrics")
  }

  return Array.from(names).slice(0, 4)
}

export async function runCopilotTools({
  question,
  siteId,
  timezone,
}: {
  question: string
  siteId: string
  timezone: string
}) {
  const range = resolveCopilotDateRange(question, timezone || "UTC")
  const tools = selectCopilotToolNames(question)
  const results: CopilotToolResult[] = []

  for (const tool of tools) {
    if (tool === "cart_metrics") results.push(await getCartMetrics(siteId, range))
    if (tool === "sales_metrics") results.push(await getSalesMetrics(siteId, range))
    if (tool === "funnel_metrics") results.push(await getFunnelMetrics(siteId, range))
    if (tool === "product_metrics") results.push(await getProductMetrics(siteId, range))
    if (tool === "acquisition_metrics") results.push(await getAcquisitionMetrics(siteId, range))
    if (tool === "recent_events") results.push(await getRecentEvents(siteId, range))
  }

  return results
}
