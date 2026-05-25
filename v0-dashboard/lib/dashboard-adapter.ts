import {
  DollarSign,
  Search,
  ShoppingCart,
  ShoppingBag,
  Users,
} from "lucide-react"

import type {
  BehavioralSegment,
  ColumnCoverage,
  DataQualityMetrics,
  EventTypeData,
  FunnelData,
  KPIData,
  ProductInsight,
  PropensityMetrics,
  SimpleMetric,
  SimpleRow,
} from "@/lib/dashboard-types"
import type { BehaviorInsights } from "@/lib/insights"

function fmtInt(value: number) {
  return value.toLocaleString()
}

function fmtPct(value: number) {
  return `${value.toFixed(2)}%`
}

function fmtMoneyTnd(value: number | null) {
  return value == null ? "—" : `${value.toFixed(2)} TND`
}

function productLabelFromUrl(value?: string) {
  if (!value) return ""
  try {
    const url = new URL(value, "https://example.com")
    const segment = url.pathname.split("/").filter(Boolean).pop() || ""
    return segment
      .replace(/\.html?$/i, "")
      .replace(/^\d+[-_]/, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  } catch {
    return ""
  }
}

function isGenericProductLabel(value?: string) {
  return [
    "accueil",
    "home",
    "recherche",
    "search",
    "produit",
    "produits",
    "product",
    "products",
    "promos",
    "promotion",
    "الرئيسية",
  ].includes((value || "").trim().toLowerCase())
}

function absoluteProductUrl(value: string | undefined, domain: string) {
  if (!value) return undefined
  try {
    return new URL(value).toString()
  } catch {
    if (!domain || !value.startsWith("/")) return undefined
    return new URL(value, `https://${domain}`).toString()
  }
}

export function buildKpis(data: BehaviorInsights): KPIData[] {
  const overview = data.business_overview
  return [
    {
      id: "purchase-rate",
      label: "Purchase Rate",
      value: overview.conversion.session_to_purchase_rate_pct,
      formattedValue: fmtPct(overview.conversion.session_to_purchase_rate_pct),
      icon: ShoppingBag,
      description: "Share of sessions that end in a completed purchase",
    },
    {
      id: "checkout-conversion",
      label: "Checkout Conversion",
      value: overview.conversion.checkout_to_purchase_rate_pct,
      formattedValue: fmtPct(overview.conversion.checkout_to_purchase_rate_pct),
      icon: ShoppingCart,
      description: "Share of checkout sessions that successfully purchase",
    },
    {
      id: "cart-conversion",
      label: "Cart Conversion",
      value: overview.conversion.cart_to_purchase_rate_pct,
      formattedValue: fmtPct(overview.conversion.cart_to_purchase_rate_pct),
      icon: DollarSign,
      description: "Share of cart sessions that turn into purchases",
    },
    {
      id: "observed-cart-value",
      label: "Observed Cart Value",
      value: overview.basket.avg_observed_cart_value_tnd ?? 0,
      formattedValue: fmtMoneyTnd(overview.basket.avg_observed_cart_value_tnd),
      icon: DollarSign,
      description: "Average observed cart total where cart value was present in the payload",
    },
    {
      id: "repeat-visitor-rate",
      label: "Repeat Visitor Rate",
      value: overview.reach.repeat_visitor_rate_pct,
      formattedValue: fmtPct(overview.reach.repeat_visitor_rate_pct),
      icon: Users,
      description: "Share of visitors with more than one recorded session",
    },
    {
      id: "search-adoption",
      label: "Search Adoption",
      value: overview.customer_growth.search_adoption_pct,
      formattedValue: fmtPct(overview.customer_growth.search_adoption_pct),
      icon: Search,
      description: "Share of sessions that include at least one search",
    },
  ]
}

export function buildFunnel(data: BehaviorInsights): FunnelData {
  const stages = data.commercial_funnel.stages.map((stage, index, arr) => ({
    id: stage.stage,
    name: stage.label,
    value: stage.sessions,
    conversionRate: stage.pct_of_all_sessions,
    dropoff: index === 0 ? 0 : Math.max(0, arr[index - 1].pct_of_all_sessions - stage.pct_of_all_sessions),
  }))
  return {
    stages,
    totalConversionRate: data.business_overview.conversion.session_to_purchase_rate_pct,
  }
}

export function buildEventMix(data: BehaviorInsights): EventTypeData[] {
  const total = Object.values(data.event_mix).reduce((sum, count) => sum + count, 0)
  return Object.entries(data.event_mix)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => ({
      name,
      count,
      percentage: total ? Number(((count / total) * 100).toFixed(2)) : 0,
    }))
}

function inferDataType(column: string): string {
  if (column.includes("timestamp")) return "datetime"
  if (column.includes("id")) return "identifier"
  if (column.includes("count") || column.includes("value") || column.includes("amount")) return "numeric"
  return "string"
}

export function buildDataQuality(data: BehaviorInsights): DataQualityMetrics {
  const eventFrequencyColumns = new Set(["add_to_cart", "checkout_start", "purchase_completed"])
  const columns: ColumnCoverage[] = Object.entries(data.column_utilization.top_15_filled)
    .filter(([column]) => !eventFrequencyColumns.has(column))
    .map(([column, share]) => ({
      column,
      fillRate: Number((share * 100).toFixed(1)),
      dataType: inferDataType(column),
    }))
  const overallCoverage =
    columns.reduce((sum, column) => sum + column.fillRate, 0) / (columns.length || 1)
  return {
    overallCoverage: Number(overallCoverage.toFixed(1)),
    totalColumns: data.dataset.columns,
    columns,
  }
}

export function buildTopPaths(data: BehaviorInsights): SimpleRow[] {
  return data.merchandising.top_paths.map((path) => ({
    id: path.path,
    label: path.path,
    value: path.events,
    secondaryValue: `${((path.events / data.dataset.rows) * 100).toFixed(2)}% of events`,
  }))
}

export function buildTopProducts(data: BehaviorInsights): SimpleRow[] {
  return data.merchandising.top_products.map((product) => ({
    id: product.product_id,
    label: product.product_name && !isGenericProductLabel(product.product_name)
      ? product.product_name
      : productLabelFromUrl(product.product_url) || `Product ${product.product_id}`,
    value: product.product_views,
    secondaryValue: `${product.engagement_events} engagement events`,
    href: absoluteProductUrl(product.product_url, data.operations.site.domain),
  }))
}

export function buildTopReferrers(data: BehaviorInsights): SimpleRow[] {
  return data.acquisition.top_referrers.map((referrer) => ({
    id: referrer.referrer_url,
    label: referrer.source,
    value: referrer.sessions,
    secondaryValue: `${referrer.channel} - ${fmtPct(referrer.share_pct)} of sessions`,
  }))
}

export function buildSegments(data: BehaviorInsights): BehavioralSegment[] {
  const segments = data.ml.session_clustering?.segments || []
  const total = segments.reduce((sum, segment) => sum + segment.sessions, 0)
  return segments.map((segment) => ({
    id: String(segment.segment_id),
    name: segment.label.replace(/_/g, " "),
    description: `Avg ${segment.mean_n_events} events, ${segment.mean_unique_pages} unique pages, ${segment.mean_duration_sec}s duration`,
    userCount: segment.sessions,
    percentage: total ? Number(((segment.sessions / total) * 100).toFixed(1)) : 0,
    traits: [
      `Cart rate ${fmtPct(segment.cart_rate_pct)}`,
      `Purchase rate ${fmtPct(segment.purchase_rate_pct)}`,
      `Avg pages ${segment.mean_unique_pages}`,
    ],
  }))
}

export function buildPropensity(data: BehaviorInsights): PropensityMetrics | null {
  const prop = data.ml.purchase_propensity
  if (!prop || prop.status !== "ok" || !prop.metrics) return null
  const totalSessions = data.business_overview.reach.sessions || 1
  const high = data.business_overview.conversion.checkout_sessions
  const medium = Math.max(data.business_overview.conversion.cart_sessions - high, 0)
  const low = Math.max(totalSessions - high - medium, 0)

  const rf = data.ml.random_forest_feature_importance || []
  const topLinear = prop.top_linear_features || []
  const source = rf.length
    ? rf.map((item) => ({
        feature: item.feature,
        importance: item.importance,
        direction: "positive" as const,
      }))
    : topLinear.map((item) => ({
        feature: item.feature,
        importance: Math.abs(item.coef),
        direction: item.coef >= 0 ? ("positive" as const) : ("negative" as const),
      }))

  return {
    overallScore: Number((prop.metrics.roc_auc * 100).toFixed(1)),
    highPropensityUsers: high,
    mediumPropensityUsers: medium,
    lowPropensityUsers: low,
    featureImportance: source.slice(0, 8),
    note: prop.note,
    modelLabel: prop.model,
    secondaryMetricLabel: "Average precision",
    secondaryMetricValue: Number((prop.metrics.avg_precision * 100).toFixed(1)),
  }
}

export function buildProductInsights(data: BehaviorInsights): ProductInsight[] {
  const notes = data.saas_product_notes || []
  const dropoff = data.commercial_funnel.largest_dropoff
  const topDevice = data.audience.device_mix[0]
  const searchTerm = data.merchandising.top_search_terms[0]

  const derived: ProductInsight[] = [
    {
      id: "dropoff",
      type: "warning",
      title: "Largest funnel drop-off is before cart creation",
      description: `The sharpest decline happens from ${dropoff.from_stage} to ${dropoff.to_stage}, so the next product win is improving PDP persuasion and add-to-cart intent.`,
      metric: { label: "Drop-off", value: `${dropoff.dropoff_pct_points.toFixed(2)} pts` },
    },
    topDevice
      ? {
          id: "device",
          type: "info",
          title: `${topDevice.device_type} is the primary traffic device`,
          description: `This device segment drives the largest session share in the sample, so mobile-vs-desktop splits should be first-class in the product.`,
          metric: { label: "Session share", value: fmtPct(topDevice.share_pct) },
        }
      : null,
    searchTerm
      ? {
          id: "search",
          type: "opportunity",
          title: "Search behavior is visible but still underused",
          description: `Top observed query is "${searchTerm.term}". Search adoption is still low, which suggests there is room to improve onsite discovery.`,
          metric: { label: "Top query volume", value: fmtInt(searchTerm.searches) },
        }
      : null,
  ].filter(Boolean) as ProductInsight[]

  return [...derived, ...notes.map((note, index) => ({
    id: `note-${index}`,
    type: "info" as const,
    title: `Business takeaway ${index + 1}`,
    description: note,
  }))]
}

export function buildSummaryMetrics(data: BehaviorInsights): SimpleMetric[] {
  return [
    { label: "Sessions", value: fmtInt(data.business_overview.reach.sessions) },
    { label: "Visitors", value: fmtInt(data.business_overview.reach.visitors) },
    { label: "Purchases", value: fmtInt(data.business_overview.conversion.purchase_sessions) },
    { label: "New sessions", value: fmtInt(data.business_overview.customer_growth.new_sessions) },
  ]
}

export function buildCustomerMetrics(data: BehaviorInsights): SimpleMetric[] {
  return [
    { label: "Registered sessions", value: fmtInt(data.customer.accounts.sessions_with_registration) },
    { label: "Identified sessions", value: fmtInt(data.customer.accounts.identified_or_registered_sessions) },
    { label: "Newsletter opt-in", value: fmtPct(data.customer.newsletter.opt_in_rate_pct) },
    { label: "Multi-session visitors", value: fmtInt(data.audience.visitor_loyalty.multi_session_visitors) },
  ]
}

export function buildBasketMetrics(data: BehaviorInsights): SimpleMetric[] {
  return [
    { label: "Avg observed cart value", value: fmtMoneyTnd(data.business_overview.basket.avg_observed_cart_value_tnd) },
    { label: "Median cart value", value: fmtMoneyTnd(data.business_overview.basket.median_observed_cart_value_tnd) },
    { label: "Avg cart items", value: data.business_overview.basket.avg_observed_cart_items?.toFixed(2) ?? "—" },
    { label: "Payment failures", value: fmtInt(data.checkout.session_health.payment_failed_sessions) },
  ]
}
