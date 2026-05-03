-- Example dashboard queries for the Layer 2 behaviour analytics tables.
-- Use FINAL while testing because the tables use ReplacingMergeTree.

-- 1. Executive overview
SELECT
    metric_date,
    sessions,
    visitors,
    raw_events,
    purchase_sessions,
    revenue,
    session_to_purchase_rate_pct,
    checkout_to_purchase_rate_pct,
    cart_abandonment_rate_pct,
    bounce_rate_pct
FROM tracer.site_daily_metrics FINAL
WHERE site_id = 'tdiscount'
ORDER BY metric_date DESC
LIMIT 30;

-- 2. Hourly real-time trend
SELECT
    hour_start,
    raw_events,
    sessions,
    visitors,
    page_views,
    product_views,
    checkout_starts,
    purchases,
    revenue
FROM tracer.site_hourly_metrics FINAL
WHERE site_id = 'tdiscount'
ORDER BY hour_start DESC
LIMIT 48;

-- 3. Funnel
SELECT
    metric_date,
    sessions,
    product_view_sessions,
    add_to_cart_sessions,
    checkout_start_sessions,
    purchase_sessions,
    session_to_purchase_rate_pct,
    product_to_cart_rate_pct,
    cart_to_checkout_rate_pct,
    checkout_to_purchase_rate_pct
FROM tracer.site_daily_metrics FINAL
WHERE site_id = 'tdiscount'
ORDER BY metric_date DESC
LIMIT 30;

-- 4. Top event types
SELECT
    event_name,
    sum(events) AS events,
    sum(sessions) AS sessions,
    sum(visitors) AS visitors
FROM tracer.event_daily_metrics FINAL
WHERE site_id = 'tdiscount'
  AND metric_date >= today() - 7
GROUP BY event_name
ORDER BY events DESC
LIMIT 20;

-- 5. Top products
SELECT
    product_id,
    anyLast(product_name) AS product_name,
    sum(impressions) AS impressions,
    sum(views) AS views,
    sum(clicks) AS clicks,
    sum(add_to_cart_events) AS add_to_cart_events,
    sum(purchase_events) AS purchase_events,
    sum(revenue) AS revenue
FROM tracer.product_daily_metrics FINAL
WHERE site_id = 'tdiscount'
  AND metric_date >= today() - 7
GROUP BY product_id
ORDER BY views DESC
LIMIT 20;

-- 6. Products with interest but no cart
SELECT
    product_id,
    anyLast(product_name) AS product_name,
    sum(views) AS views,
    sum(add_to_cart_events) AS add_to_cart_events
FROM tracer.product_daily_metrics FINAL
WHERE site_id = 'tdiscount'
  AND metric_date >= today() - 7
GROUP BY product_id
HAVING views >= 10 AND add_to_cart_events = 0
ORDER BY views DESC
LIMIT 20;

-- 7. Top pages and paths
SELECT
    page_type,
    page_path,
    sum(events) AS events,
    sum(page_views) AS page_views,
    sum(sessions) AS sessions,
    sum(visitors) AS visitors
FROM tracer.page_daily_metrics FINAL
WHERE site_id = 'tdiscount'
  AND metric_date >= today() - 7
GROUP BY page_type, page_path
ORDER BY events DESC
LIMIT 20;

-- 8. Search demand
SELECT
    search_term,
    sum(search_events) AS search_events,
    sum(zero_result_events) AS zero_result_events,
    sum(autocomplete_clicks) AS autocomplete_clicks,
    sum(sessions) AS sessions
FROM tracer.search_daily_metrics FINAL
WHERE site_id = 'tdiscount'
  AND metric_date >= today() - 7
GROUP BY search_term
ORDER BY search_events DESC
LIMIT 20;

-- 9. Checkout methods
SELECT
    method_type,
    method_value,
    sum(events) AS events,
    sum(sessions) AS sessions,
    sum(purchases) AS purchases,
    sum(revenue) AS revenue
FROM tracer.checkout_method_daily_metrics FINAL
WHERE site_id = 'tdiscount'
  AND metric_date >= today() - 7
GROUP BY method_type, method_value
ORDER BY events DESC
LIMIT 20;

-- 10. Visitor segments without ML
SELECT
    buyer_stage,
    count() AS visitors,
    round(avg(engagement_score), 2) AS avg_engagement_score,
    sum(purchases) AS purchases,
    sum(revenue) AS revenue
FROM tracer.visitor_features FINAL
WHERE site_id = 'tdiscount'
GROUP BY buyer_stage
ORDER BY visitors DESC;

-- 11. Data quality
SELECT
    metric_date,
    total_events,
    missing_session_id_events,
    missing_visitor_id_events,
    missing_page_url_events,
    product_events_missing_product_id,
    purchase_events_missing_total,
    add_to_cart_events,
    checkout_start_events,
    purchase_events
FROM tracer.event_data_quality_daily FINAL
WHERE site_id = 'tdiscount'
ORDER BY metric_date DESC
LIMIT 30;

-- 12. Recommendation cards
SELECT
    category,
    severity,
    title,
    detail,
    recommendation,
    metric_name,
    metric_value
FROM tracer.site_latest_insights FINAL
WHERE site_id = 'tdiscount'
ORDER BY
    multiIf(severity = 'high', 1, severity = 'medium', 2, severity = 'info', 3, 4),
    category,
    insight_key;
