import { clickhouseQuery, num, sqlString, str } from "@/lib/clickhouse"

export interface BehaviorInsights {
  dataset: {
    rows: number
    columns: number
    unique_visitors: number
    unique_sessions: number
    date_range_utc: {
      min: string | null
      max: string | null
    }
  }
  business_overview: {
    reach: {
      raw_events: number
      sessions: number
      visitors: number
      repeat_visitor_rate_pct: number
    }
    conversion: {
      product_view_sessions: number
      cart_sessions: number
      checkout_sessions: number
      purchase_sessions: number
      session_to_purchase_rate_pct: number
      cart_to_purchase_rate_pct: number
      checkout_to_purchase_rate_pct: number
    }
    customer_growth: {
      new_sessions: number
      returning_sessions: number
      search_sessions: number
      registration_sessions: number
      search_adoption_pct: number
    }
    basket: {
      sessions_with_cart_value: number
      avg_observed_cart_value_tnd: number | null
      median_observed_cart_value_tnd: number | null
      avg_observed_cart_items: number | null
      max_observed_cart_value_tnd: number | null
    }
  }
  commercial_funnel: {
    stages: Array<{
      stage: string
      label: string
      sessions: number
      pct_of_all_sessions: number
      pct_from_previous_stage: number
    }>
    largest_dropoff: {
      from_stage: string
      to_stage: string
      dropoff_pct_points: number
    }
  }
  audience: {
    device_mix: Array<{
      device_type: string
      sessions: number
      share_pct: number
    }>
    visitor_loyalty: {
      single_session_visitors: number
      multi_session_visitors: number
      visitors_with_purchase: number
    }
    engagement: {
      avg_events_per_session: number
      median_events_per_session: number
      avg_session_duration_sec: number
      median_session_duration_sec: number
    }
  }
  acquisition: {
    top_referrers: Array<{
      referrer_url: string
      source: string
      channel: string
      sessions: number
      visitors: number
      purchases: number
      revenue: number
      share_pct: number
    }>
    channel_mix: Array<{
      channel: string
      sessions: number
      share_pct: number
      purchases: number
      revenue: number
    }>
  }
  merchandising: {
    top_page_types: Array<{ page_type: string; events: number }>
    top_search_terms: Array<{ term: string; searches: number }>
    top_products: Array<{
      product_id: string
      product_name?: string
      product_views: number
      impressions: number
      clicks: number
      add_to_cart_events: number
      engagement_events: number
    }>
    top_paths: Array<{ path: string; events: number }>
  }
  checkout: {
    session_health: {
      checkout_sessions: number
      shipping_selection_sessions: number
      payment_selection_sessions: number
      purchase_sessions: number
      payment_failed_sessions: number
      shipping_selection_rate_pct: number
      payment_selection_rate_pct: number
    }
    top_shipping_methods: Array<{ shipping_method: string; count: number }>
    top_payment_methods: Array<{ payment_method: string; count: number }>
    checkout_steps_observed: Array<{ step_name: string; count: number }>
  }
  customer: {
    accounts: {
      registration_events: number
      sessions_with_registration: number
      identified_or_registered_sessions: number
    }
    newsletter: {
      opt_in_events: number
      opt_in_rate_pct: number
      events_with_newsletter_signal: number
    }
    registration_sources: Array<{ source: string; count: number }>
  }
  daily_trends: Array<{
    date: string
    events: number
    sessions: number
    visitors: number
    purchases: number
    add_to_cart: number
  }>
  column_utilization: {
    note: string
    top_15_filled: Record<string, number>
  }
  event_mix: Record<string, number>
  ml: {
    session_clustering?: {
      segments: Array<{
        segment_id: number
        sessions: number
        mean_n_events: number
        mean_duration_sec: number
        mean_unique_pages: number
        cart_rate_pct: number
        purchase_rate_pct: number
        label: string
      }>
    }
    purchase_propensity?: {
      status: string
      model?: string
      note?: string
      metrics?: {
        roc_auc: number
        avg_precision: number
      }
      top_linear_features?: Array<{
        feature: string
        coef: number
      }>
      reason?: string
    }
    random_forest_feature_importance?: Array<{
      feature: string
      importance: number
    }>
  }
  operations: {
    site: {
      site_id: string
      tenant_id: string
      domain: string
      platform: string
      status: string
      plan: string
      timezone: string
      allowed_origins: string[]
    }
    keys: Array<{
      key_type: string
      key_prefix: string
      status: string
      created_at: string
      revoked_at: string | null
    }>
    analysis_runs: Array<{
      run_id: string
      pipeline: string
      status: string
      rows_written: number
      message: string
      started_at: string
      finished_at: string | null
      updated_at: string
    }>
    recent_events: Array<{
      event_name: string
      event_type: string
      page_url: string
      source: string
      platform: string
      received_at: string
    }>
  }
  saas_product_notes: string[]
}

function safePct(numerator: number, denominator: number) {
  return denominator ? Number(((100 * numerator) / denominator).toFixed(2)) : 0
}

function latest<T>(rows: T[], fallback: T): T {
  return rows[0] || fallback
}

function getSiteId(siteId?: string) {
  return siteId || process.env.DASHBOARD_SITE_ID || "tdiscount"
}

function getLookbackDays() {
  const parsed = Number(process.env.DASHBOARD_LOOKBACK_DAYS || 7)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7
}

function emptyInsights(siteId: string): BehaviorInsights {
  return {
    dataset: {
      rows: 0,
      columns: 0,
      unique_visitors: 0,
      unique_sessions: 0,
      date_range_utc: { min: null, max: null },
    },
    business_overview: {
      reach: { raw_events: 0, sessions: 0, visitors: 0, repeat_visitor_rate_pct: 0 },
      conversion: {
        product_view_sessions: 0,
        cart_sessions: 0,
        checkout_sessions: 0,
        purchase_sessions: 0,
        session_to_purchase_rate_pct: 0,
        cart_to_purchase_rate_pct: 0,
        checkout_to_purchase_rate_pct: 0,
      },
      customer_growth: {
        new_sessions: 0,
        returning_sessions: 0,
        search_sessions: 0,
        registration_sessions: 0,
        search_adoption_pct: 0,
      },
      basket: {
        sessions_with_cart_value: 0,
        avg_observed_cart_value_tnd: null,
        median_observed_cart_value_tnd: null,
        avg_observed_cart_items: null,
        max_observed_cart_value_tnd: null,
      },
    },
    commercial_funnel: {
      stages: [
        { stage: "sessions", label: "All sessions", sessions: 0, pct_of_all_sessions: 0, pct_from_previous_stage: 0 },
        { stage: "product_view", label: "Viewed a product", sessions: 0, pct_of_all_sessions: 0, pct_from_previous_stage: 0 },
        { stage: "add_to_cart", label: "Added to cart", sessions: 0, pct_of_all_sessions: 0, pct_from_previous_stage: 0 },
        { stage: "checkout_start", label: "Started checkout", sessions: 0, pct_of_all_sessions: 0, pct_from_previous_stage: 0 },
        { stage: "purchase_completed", label: "Purchased", sessions: 0, pct_of_all_sessions: 0, pct_from_previous_stage: 0 },
      ],
      largest_dropoff: { from_stage: "sessions", to_stage: "product_view", dropoff_pct_points: 0 },
    },
    audience: {
      device_mix: [],
      visitor_loyalty: { single_session_visitors: 0, multi_session_visitors: 0, visitors_with_purchase: 0 },
      engagement: {
        avg_events_per_session: 0,
        median_events_per_session: 0,
        avg_session_duration_sec: 0,
        median_session_duration_sec: 0,
      },
    },
    acquisition: {
      top_referrers: [],
      channel_mix: [],
    },
    merchandising: { top_page_types: [], top_search_terms: [], top_products: [], top_paths: [] },
    checkout: {
      session_health: {
        checkout_sessions: 0,
        shipping_selection_sessions: 0,
        payment_selection_sessions: 0,
        purchase_sessions: 0,
        payment_failed_sessions: 0,
        shipping_selection_rate_pct: 0,
        payment_selection_rate_pct: 0,
      },
      top_shipping_methods: [],
      top_payment_methods: [],
      checkout_steps_observed: [],
    },
    customer: {
      accounts: {
        registration_events: 0,
        sessions_with_registration: 0,
        identified_or_registered_sessions: 0,
      },
      newsletter: { opt_in_events: 0, opt_in_rate_pct: 0, events_with_newsletter_signal: 0 },
      registration_sources: [],
    },
    daily_trends: [],
    column_utilization: {
      note: `No Layer 2 metrics are available for site_id=${siteId}. Trigger the Airflow Layer 2 DAG first.`,
      top_15_filled: {},
    },
    event_mix: {},
    ml: {},
    operations: {
      site: {
        site_id: siteId,
        tenant_id: "",
        domain: "",
        platform: "",
        status: "inactive",
        plan: "",
        timezone: "UTC",
        allowed_origins: [],
      },
      keys: [],
      analysis_runs: [],
      recent_events: [],
    },
    saas_product_notes: [],
  }
}

function buildFunnel(summary: Record<string, unknown>) {
  const sessions = num(summary.sessions)
  const stages = [
    { stage: "sessions", label: "All sessions", sessions },
    { stage: "product_view", label: "Viewed a product", sessions: num(summary.product_view_sessions) },
    { stage: "add_to_cart", label: "Added to cart", sessions: num(summary.add_to_cart_sessions) },
    { stage: "checkout_start", label: "Started checkout", sessions: num(summary.checkout_start_sessions) },
    { stage: "purchase_completed", label: "Purchased", sessions: num(summary.purchase_sessions) },
  ]

  const rows = stages.map((stage, index) => {
    const previous = index === 0 ? sessions : stages[index - 1].sessions
    return {
      ...stage,
      pct_of_all_sessions: safePct(stage.sessions, sessions),
      pct_from_previous_stage: safePct(stage.sessions, previous),
    }
  })

  let largest = { from_stage: rows[0].stage, to_stage: rows[1].stage, dropoff_pct_points: 0 }
  for (let i = 0; i < rows.length - 1; i += 1) {
    const drop = Number((rows[i].pct_of_all_sessions - rows[i + 1].pct_of_all_sessions).toFixed(2))
    if (drop > largest.dropoff_pct_points) {
      largest = { from_stage: rows[i].stage, to_stage: rows[i + 1].stage, dropoff_pct_points: drop }
    }
  }

  return { stages: rows, largest_dropoff: largest }
}

function referrerSource(referrerUrl: string) {
  if (!referrerUrl) return "Direct"
  try {
    const parsed = new URL(referrerUrl)
    return parsed.hostname.replace(/^www\./, "")
  } catch {
    return referrerUrl.replace(/^https?:\/\//, "").split("/")[0] || referrerUrl
  }
}

function referrerChannel(referrerUrl: string) {
  const source = referrerSource(referrerUrl).toLowerCase()
  if (!source || source === "direct") return "Direct"
  if (source.includes("tdiscount") || source.includes("yatootunisie")) return "Internal"
  if (
    source.includes("google.") ||
    source.includes("bing.") ||
    source.includes("yahoo.") ||
    source.includes("duckduckgo.") ||
    source.includes("brave.") ||
    source.includes("search.")
  ) {
    return "Organic search"
  }
  if (
    source.includes("facebook.") ||
    source.includes("instagram.") ||
    source.includes("tiktok.") ||
    source.includes("linkedin.") ||
    source.includes("twitter.") ||
    source.includes("x.com") ||
    source.includes("youtube.")
  ) {
    return "Social"
  }
  return "Referral"
}

export async function loadInsights(siteIdOverride?: string): Promise<BehaviorInsights> {
  const siteId = getSiteId(siteIdOverride)
  const days = getLookbackDays()
  const quotedSite = sqlString(siteId)
  const dateFilter = `metric_date >= today() - ${days}`
  const sessionFilter = `session_start >= now() - INTERVAL ${days} DAY`
  const eventFilter = `event_timestamp >= now() - INTERVAL ${days} DAY`

  const [
    datasetRows,
    columnRows,
    summaryRows,
    engagementRows,
    loyaltyRows,
    deviceRows,
    referrerRows,
    trendRows,
    eventRows,
    pageTypeRows,
    pathRows,
    productRows,
    searchRows,
    paymentRows,
    shippingRows,
    qualityRows,
    insightRows,
    segmentRows,
    recentEventRows,
    siteRows,
    keyRows,
    runRows,
  ] = await Promise.all([
    clickhouseQuery(`
      SELECT
        count() AS rows,
        uniqExact(session_id) AS unique_sessions,
        uniqExact(visitor_id) AS unique_visitors,
        min(event_timestamp) AS min_ts,
        max(event_timestamp) AS max_ts
      FROM tracer.ecommerce_events
      WHERE site_id = ${quotedSite}
        AND ${eventFilter}
    `),
    clickhouseQuery(`
      SELECT count() AS columns
      FROM system.columns
      WHERE database = 'tracer'
        AND table = 'ecommerce_events'
    `),
    clickhouseQuery(`
      SELECT
        sum(sessions) AS sessions,
        sum(visitors) AS visitors,
        sum(raw_events) AS raw_events,
        sum(page_views) AS page_views,
        sum(product_view_sessions) AS product_view_sessions,
        sum(add_to_cart_sessions) AS add_to_cart_sessions,
        sum(checkout_start_sessions) AS checkout_start_sessions,
        sum(purchase_sessions) AS purchase_sessions,
        sum(cart_abandoned_sessions) AS cart_abandoned_sessions,
        sum(checkout_abandoned_sessions) AS checkout_abandoned_sessions,
        sum(bounce_sessions) AS bounce_sessions,
        sum(search_sessions) AS search_sessions,
        sum(zero_result_search_sessions) AS zero_result_search_sessions,
        sum(registration_sessions) AS registration_sessions,
        sum(login_sessions) AS login_sessions,
        sum(newsletter_opt_in_events) AS newsletter_opt_in_events,
        sum(revenue) AS revenue,
        round(avg(avg_events_per_session), 2) AS avg_events_per_session,
        round(avg(avg_session_duration_sec), 2) AS avg_session_duration_sec
      FROM tracer.site_daily_metrics FINAL
      WHERE site_id = ${quotedSite}
        AND ${dateFilter}
    `),
    clickhouseQuery(`
      SELECT
        round(avg(event_count), 2) AS avg_events_per_session,
        round(quantileExact(0.5)(event_count), 2) AS median_events_per_session,
        round(avg(duration_sec), 2) AS avg_session_duration_sec,
        round(quantileExact(0.5)(duration_sec), 2) AS median_session_duration_sec,
        countIf(is_new_visitor = 1) AS new_sessions,
        countIf(cart_value_max > 0) AS sessions_with_cart_value,
        round(avgIf(cart_value_max, cart_value_max > 0), 2) AS avg_observed_cart_value_tnd,
        round(quantileExactIf(0.5)(cart_value_max, cart_value_max > 0), 2) AS median_observed_cart_value_tnd,
        round(max(cart_value_max), 2) AS max_observed_cart_value_tnd
      FROM tracer.session_features FINAL
      WHERE site_id = ${quotedSite}
        AND ${sessionFilter}
    `),
    clickhouseQuery(`
      SELECT
        countIf(sessions = 1) AS single_session_visitors,
        countIf(sessions > 1) AS multi_session_visitors,
        countIf(purchases > 0) AS visitors_with_purchase
      FROM tracer.visitor_features FINAL
      WHERE site_id = ${quotedSite}
    `),
    clickhouseQuery(`
      SELECT
        device_type,
        count() AS sessions
      FROM tracer.session_features FINAL
      WHERE site_id = ${quotedSite}
        AND ${sessionFilter}
      GROUP BY device_type
      ORDER BY sessions DESC
      LIMIT 8
    `),
    clickhouseQuery(`
      SELECT
        referrer_url,
        count() AS sessions,
        uniqExact(visitor_id) AS visitors,
        sum(purchase_count) AS purchases,
        sum(revenue) AS revenue
      FROM tracer.session_features FINAL
      WHERE site_id = ${quotedSite}
        AND ${sessionFilter}
      GROUP BY referrer_url
      ORDER BY sessions DESC
      LIMIT 100
    `),
    clickhouseQuery(`
      SELECT
        metric_date AS date,
        sum(raw_events) AS events,
        sum(sessions) AS sessions,
        sum(visitors) AS visitors,
        sum(purchase_sessions) AS purchases,
        sum(add_to_cart_sessions) AS add_to_cart
      FROM tracer.site_daily_metrics FINAL
      WHERE site_id = ${quotedSite}
        AND ${dateFilter}
      GROUP BY metric_date
      ORDER BY metric_date ASC
    `),
    clickhouseQuery(`
      SELECT
        event_name,
        sum(events) AS events
      FROM tracer.event_daily_metrics FINAL
      WHERE site_id = ${quotedSite}
        AND ${dateFilter}
      GROUP BY event_name
      ORDER BY events DESC
      LIMIT 25
    `),
    clickhouseQuery(`
      SELECT
        page_type,
        sum(events) AS events
      FROM tracer.page_daily_metrics FINAL
      WHERE site_id = ${quotedSite}
        AND ${dateFilter}
      GROUP BY page_type
      ORDER BY events DESC
      LIMIT 8
    `),
    clickhouseQuery(`
      SELECT
        page_path,
        sum(events) AS events
      FROM tracer.page_daily_metrics FINAL
      WHERE site_id = ${quotedSite}
        AND ${dateFilter}
      GROUP BY page_path
      ORDER BY events DESC
      LIMIT 12
    `),
    clickhouseQuery(`
      SELECT
        product_id,
        anyLast(product_name) AS product_name,
        sum(views) AS product_views,
        sum(impressions) AS impressions,
        sum(clicks) AS clicks,
        sum(add_to_cart_events) AS add_to_cart_events
      FROM tracer.product_daily_metrics FINAL
      WHERE site_id = ${quotedSite}
        AND ${dateFilter}
      GROUP BY product_id
      ORDER BY product_views DESC
      LIMIT 12
    `),
    clickhouseQuery(`
      SELECT
        search_term,
        sum(search_events) AS searches
      FROM tracer.search_daily_metrics FINAL
      WHERE site_id = ${quotedSite}
        AND ${dateFilter}
      GROUP BY search_term
      ORDER BY searches DESC
      LIMIT 10
    `),
    clickhouseQuery(`
      SELECT
        method_value,
        sum(events) AS events
      FROM tracer.checkout_method_daily_metrics FINAL
      WHERE site_id = ${quotedSite}
        AND ${dateFilter}
        AND method_type = 'payment'
      GROUP BY method_value
      ORDER BY events DESC
      LIMIT 5
    `),
    clickhouseQuery(`
      SELECT
        method_value,
        sum(events) AS events
      FROM tracer.checkout_method_daily_metrics FINAL
      WHERE site_id = ${quotedSite}
        AND ${dateFilter}
        AND method_type = 'shipping'
      GROUP BY method_value
      ORDER BY events DESC
      LIMIT 5
    `),
    clickhouseQuery(`
      SELECT
        sum(total_events) AS total_events,
        sum(missing_session_id_events) AS missing_session_id_events,
        sum(missing_visitor_id_events) AS missing_visitor_id_events,
        sum(missing_page_url_events) AS missing_page_url_events,
        sum(product_events_missing_product_id) AS product_events_missing_product_id,
        sum(purchase_events_missing_total) AS purchase_events_missing_total,
        sum(events_with_customer_id) AS events_with_customer_id,
        sum(events_with_location) AS events_with_location,
        sum(add_to_cart_events) AS add_to_cart_events,
        sum(checkout_start_events) AS checkout_start_events,
        sum(purchase_events) AS purchase_events
      FROM tracer.event_data_quality_daily FINAL
      WHERE site_id = ${quotedSite}
        AND ${dateFilter}
    `),
    clickhouseQuery(`
      SELECT
        insight_key,
        category,
        severity,
        title,
        detail,
        recommendation,
        metric_name,
        metric_value
      FROM tracer.site_latest_insights FINAL
      WHERE site_id = ${quotedSite}
      ORDER BY
        multiIf(severity = 'high', 1, severity = 'medium', 2, severity = 'info', 3, 4),
        category,
        insight_key
      LIMIT 12
    `),
    clickhouseQuery(`
      SELECT
        buyer_stage,
        count() AS visitors,
        round(avg(total_events), 1) AS mean_n_events,
        round(avg(total_duration_sec), 1) AS mean_duration_sec,
        round(avg(product_views), 2) AS mean_unique_pages,
        round(100 * countIf(add_to_cart_events > 0) / greatest(count(), 1), 2) AS cart_rate_pct,
        round(100 * countIf(purchases > 0) / greatest(count(), 1), 2) AS purchase_rate_pct
      FROM tracer.visitor_features FINAL
      WHERE site_id = ${quotedSite}
      GROUP BY buyer_stage
      ORDER BY visitors DESC
      LIMIT 6
    `),
    clickhouseQuery(`
      SELECT
        event_name,
        event_type,
        page_url,
        source,
        platform,
        received_at
      FROM tracer.ecommerce_events
      WHERE site_id = ${quotedSite}
        AND ${eventFilter}
      ORDER BY received_at DESC
      LIMIT 12
    `),
    clickhouseQuery(`
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
      WHERE site_id = ${quotedSite}
      ORDER BY updated_at DESC
      LIMIT 1
    `),
    clickhouseQuery(`
      SELECT
        key_type,
        key_prefix,
        status,
        created_at,
        revoked_at
      FROM tracer.site_keys FINAL
      WHERE site_id = ${quotedSite}
      ORDER BY created_at DESC
      LIMIT 8
    `),
    clickhouseQuery(`
      SELECT
        run_id,
        pipeline,
        status,
        rows_written,
        message,
        started_at,
        finished_at,
        updated_at
      FROM tracer.analysis_runs FINAL
      WHERE site_id = ${quotedSite}
      ORDER BY updated_at DESC
      LIMIT 8
    `),
  ])

  const dataset = latest(datasetRows, {})
  const columns = latest(columnRows, {})
  const summary = latest(summaryRows, {})
  const engagement = latest(engagementRows, {})
  const loyalty = latest(loyaltyRows, {})
  const quality = latest(qualityRows, {})
  const site = latest(siteRows, {})
  const sessions = num(summary.sessions)

  if (!sessions && !num(dataset.rows)) {
    return emptyInsights(siteId)
  }

  const conversion = {
    product_view_sessions: num(summary.product_view_sessions),
    cart_sessions: num(summary.add_to_cart_sessions),
    checkout_sessions: num(summary.checkout_start_sessions),
    purchase_sessions: num(summary.purchase_sessions),
    session_to_purchase_rate_pct: safePct(num(summary.purchase_sessions), sessions),
    cart_to_purchase_rate_pct: safePct(num(summary.purchase_sessions), num(summary.add_to_cart_sessions)),
    checkout_to_purchase_rate_pct: safePct(num(summary.purchase_sessions), num(summary.checkout_start_sessions)),
  }

  const newSessions = num(engagement.new_sessions)
  const returningSessions = Math.max(sessions - newSessions, 0)
  const deviceTotal = deviceRows.reduce((sum, row) => sum + num(row.sessions), 0)
  const referrerTotal = referrerRows.reduce((sum, row) => sum + num(row.sessions), 0)
  const topReferrers = referrerRows
    .filter((row) => str(row.referrer_url).trim() !== "")
    .slice(0, 10)
    .map((row) => {
      const referrerUrl = str(row.referrer_url)
      return {
        referrer_url: referrerUrl,
        source: referrerSource(referrerUrl),
        channel: referrerChannel(referrerUrl),
        sessions: num(row.sessions),
        visitors: num(row.visitors),
        purchases: num(row.purchases),
        revenue: num(row.revenue),
        share_pct: safePct(num(row.sessions), referrerTotal || sessions),
      }
    })
  const channels = new Map<string, { sessions: number; purchases: number; revenue: number }>()
  for (const row of referrerRows) {
    const channel = referrerChannel(str(row.referrer_url))
    const current = channels.get(channel) || { sessions: 0, purchases: 0, revenue: 0 }
    current.sessions += num(row.sessions)
    current.purchases += num(row.purchases)
    current.revenue += num(row.revenue)
    channels.set(channel, current)
  }
  const channelMix = Array.from(channels.entries())
    .map(([channel, row]) => ({
      channel,
      sessions: row.sessions,
      share_pct: safePct(row.sessions, referrerTotal || sessions),
      purchases: row.purchases,
      revenue: row.revenue,
    }))
    .sort((a, b) => b.sessions - a.sessions)
  const eventMix = Object.fromEntries(eventRows.map((row) => [str(row.event_name, "unknown"), num(row.events)]))
  const dataQualityTotal = num(quality.total_events)
  const filled = {
    session_id: dataQualityTotal ? 1 - num(quality.missing_session_id_events) / dataQualityTotal : 0,
    visitor_id: dataQualityTotal ? 1 - num(quality.missing_visitor_id_events) / dataQualityTotal : 0,
    page_url: dataQualityTotal ? 1 - num(quality.missing_page_url_events) / dataQualityTotal : 0,
    customer_id: dataQualityTotal ? num(quality.events_with_customer_id) / dataQualityTotal : 0,
    location: dataQualityTotal ? num(quality.events_with_location) / dataQualityTotal : 0,
    "product_id on product events": 1 - safePct(num(quality.product_events_missing_product_id), dataQualityTotal) / 100,
    "order total on purchase": 1 - safePct(num(quality.purchase_events_missing_total), Math.max(num(quality.purchase_events), 1)) / 100,
    add_to_cart: dataQualityTotal ? num(quality.add_to_cart_events) / dataQualityTotal : 0,
    checkout_start: dataQualityTotal ? num(quality.checkout_start_events) / dataQualityTotal : 0,
    purchase_completed: dataQualityTotal ? num(quality.purchase_events) / dataQualityTotal : 0,
  }

  const notes = insightRows.flatMap((row) => {
    const detail = str(row.detail)
    const recommendation = str(row.recommendation)
    return recommendation ? [`${detail} ${recommendation}`] : detail ? [detail] : []
  })

  return {
    dataset: {
      rows: num(dataset.rows),
      columns: num(columns.columns),
      unique_visitors: num(dataset.unique_visitors),
      unique_sessions: num(dataset.unique_sessions),
      date_range_utc: {
        min: dataset.min_ts ? str(dataset.min_ts) : null,
        max: dataset.max_ts ? str(dataset.max_ts) : null,
      },
    },
    business_overview: {
      reach: {
        raw_events: num(summary.raw_events),
        sessions,
        visitors: num(summary.visitors),
        repeat_visitor_rate_pct: safePct(num(loyalty.multi_session_visitors), num(loyalty.single_session_visitors) + num(loyalty.multi_session_visitors)),
      },
      conversion,
      customer_growth: {
        new_sessions: newSessions,
        returning_sessions: returningSessions,
        search_sessions: num(summary.search_sessions),
        registration_sessions: num(summary.registration_sessions),
        search_adoption_pct: safePct(num(summary.search_sessions), sessions),
      },
      basket: {
        sessions_with_cart_value: num(engagement.sessions_with_cart_value),
        avg_observed_cart_value_tnd: engagement.avg_observed_cart_value_tnd == null ? null : num(engagement.avg_observed_cart_value_tnd),
        median_observed_cart_value_tnd: engagement.median_observed_cart_value_tnd == null ? null : num(engagement.median_observed_cart_value_tnd),
        avg_observed_cart_items: null,
        max_observed_cart_value_tnd: engagement.max_observed_cart_value_tnd == null ? null : num(engagement.max_observed_cart_value_tnd),
      },
    },
    commercial_funnel: buildFunnel(summary),
    audience: {
      device_mix: deviceRows.map((row) => ({
        device_type: str(row.device_type, "unknown"),
        sessions: num(row.sessions),
        share_pct: safePct(num(row.sessions), deviceTotal),
      })),
      visitor_loyalty: {
        single_session_visitors: num(loyalty.single_session_visitors),
        multi_session_visitors: num(loyalty.multi_session_visitors),
        visitors_with_purchase: num(loyalty.visitors_with_purchase),
      },
      engagement: {
        avg_events_per_session: num(engagement.avg_events_per_session),
        median_events_per_session: num(engagement.median_events_per_session),
        avg_session_duration_sec: num(engagement.avg_session_duration_sec),
        median_session_duration_sec: num(engagement.median_session_duration_sec),
      },
    },
    acquisition: {
      top_referrers: topReferrers,
      channel_mix: channelMix,
    },
    merchandising: {
      top_page_types: pageTypeRows.map((row) => ({ page_type: str(row.page_type, "unknown"), events: num(row.events) })),
      top_search_terms: searchRows.map((row) => ({ term: str(row.search_term), searches: num(row.searches) })),
      top_products: productRows.map((row) => ({
        product_id: str(row.product_id),
        product_name: str(row.product_name),
        product_views: num(row.product_views),
        impressions: num(row.impressions),
        clicks: num(row.clicks),
        add_to_cart_events: num(row.add_to_cart_events),
        engagement_events: num(row.product_views) + num(row.impressions) + num(row.clicks) + num(row.add_to_cart_events),
      })),
      top_paths: pathRows.map((row) => ({ path: str(row.page_path, "/"), events: num(row.events) })),
    },
    checkout: {
      session_health: {
        checkout_sessions: conversion.checkout_sessions,
        shipping_selection_sessions: num(paymentRows.length ? summary.checkout_start_sessions : 0),
        payment_selection_sessions: num(paymentRows.length ? summary.checkout_start_sessions : 0),
        purchase_sessions: conversion.purchase_sessions,
        payment_failed_sessions: num(summary.payment_failed_sessions),
        shipping_selection_rate_pct: safePct(num(paymentRows.length ? summary.checkout_start_sessions : 0), conversion.checkout_sessions),
        payment_selection_rate_pct: safePct(num(paymentRows.length ? summary.checkout_start_sessions : 0), conversion.checkout_sessions),
      },
      top_shipping_methods: shippingRows.map((row) => ({ shipping_method: str(row.method_value), count: num(row.events) })),
      top_payment_methods: paymentRows.map((row) => ({ payment_method: str(row.method_value), count: num(row.events) })),
      checkout_steps_observed: [],
    },
    customer: {
      accounts: {
        registration_events: num(summary.registration_sessions),
        sessions_with_registration: num(summary.registration_sessions),
        identified_or_registered_sessions: num(summary.registration_sessions) + num(summary.login_sessions),
      },
      newsletter: {
        opt_in_events: num(summary.newsletter_opt_in_events),
        opt_in_rate_pct: safePct(num(summary.newsletter_opt_in_events), sessions),
        events_with_newsletter_signal: num(summary.newsletter_opt_in_events),
      },
      registration_sources: num(summary.registration_sessions)
        ? [{ source: "account_registration", count: num(summary.registration_sessions) }]
        : [],
    },
    daily_trends: trendRows.map((row) => ({
      date: str(row.date),
      events: num(row.events),
      sessions: num(row.sessions),
      visitors: num(row.visitors),
      purchases: num(row.purchases),
      add_to_cart: num(row.add_to_cart),
    })),
    column_utilization: {
      note: "Operational coverage from Layer 2 data quality checks.",
      top_15_filled: filled,
    },
    event_mix: eventMix,
    ml: {
      session_clustering: {
        segments: segmentRows.map((row, index) => ({
          segment_id: index,
          sessions: num(row.visitors),
          mean_n_events: num(row.mean_n_events),
          mean_duration_sec: num(row.mean_duration_sec),
          mean_unique_pages: num(row.mean_unique_pages),
          cart_rate_pct: num(row.cart_rate_pct),
          purchase_rate_pct: num(row.purchase_rate_pct),
          label: str(row.buyer_stage, "unknown"),
        })),
      },
      purchase_propensity: {
        status: "skipped",
        reason: "ML is intentionally delayed. Current dashboard uses deterministic Layer 2 metrics and behavior segments.",
      },
    },
    operations: {
      site: {
        site_id: str(site.site_id, siteId),
        tenant_id: str(site.tenant_id),
        domain: str(site.domain),
        platform: str(site.platform),
        status: str(site.status, "active"),
        plan: str(site.plan),
        timezone: str(site.timezone, "UTC"),
        allowed_origins: Array.isArray(site.allowed_origins) ? site.allowed_origins.map((value) => String(value)) : [],
      },
      keys: keyRows.map((row) => ({
        key_type: str(row.key_type),
        key_prefix: str(row.key_prefix),
        status: str(row.status),
        created_at: str(row.created_at),
        revoked_at: row.revoked_at == null ? null : str(row.revoked_at),
      })),
      analysis_runs: runRows.map((row) => ({
        run_id: str(row.run_id),
        pipeline: str(row.pipeline),
        status: str(row.status),
        rows_written: num(row.rows_written),
        message: str(row.message),
        started_at: str(row.started_at),
        finished_at: row.finished_at == null ? null : str(row.finished_at),
        updated_at: str(row.updated_at),
      })),
      recent_events: recentEventRows.map((row) => ({
        event_name: str(row.event_name, "unknown"),
        event_type: str(row.event_type, "custom"),
        page_url: str(row.page_url),
        source: str(row.source),
        platform: str(row.platform),
        received_at: str(row.received_at),
      })),
    },
    saas_product_notes: notes,
  }
}
