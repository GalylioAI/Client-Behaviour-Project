USE tracer;

-- Layer 2 tables for SaaS behaviour analytics.
-- These tables are derived from tracer.ecommerce_events. They do not replace
-- or delete raw events.

CREATE TABLE IF NOT EXISTS analysis_runs
(
    run_id       String,
    pipeline     LowCardinality(String),
    site_id      LowCardinality(String),
    window_start DateTime64(3, 'UTC'),
    window_end   DateTime64(3, 'UTC'),
    status       LowCardinality(String),
    rows_written UInt64 DEFAULT 0,
    message      String DEFAULT '',
    started_at   DateTime64(3, 'UTC'),
    finished_at  Nullable(DateTime64(3, 'UTC')),
    updated_at   DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(started_at)
ORDER BY (pipeline, site_id, run_id);

CREATE TABLE IF NOT EXISTS session_features
(
    site_id                     LowCardinality(String),
    platform                    LowCardinality(String),
    session_id                  String,
    visitor_id                  String,
    customer_id                 String,
    customer_email              Nullable(String),
    session_start               DateTime64(3, 'UTC'),
    session_end                 DateTime64(3, 'UTC'),
    duration_sec                UInt64,
    event_count                 UInt64,
    page_view_count             UInt64,
    product_view_count          UInt64,
    product_impression_count    UInt64,
    click_count                 UInt64,
    scroll_event_count          UInt64,
    search_event_count          UInt64,
    zero_result_search_count    UInt64,
    add_to_cart_count           UInt64,
    remove_from_cart_count      UInt64,
    cart_view_count             UInt64,
    checkout_start_count        UInt64,
    shipping_selection_count    UInt64,
    payment_selection_count     UInt64,
    payment_failed_count        UInt64,
    purchase_count              UInt64,
    registration_count          UInt64,
    login_count                 UInt64,
    newsletter_opt_in_count     UInt64,
    unique_pages                UInt64,
    unique_products_viewed      UInt64,
    unique_products_added_cart  UInt64,
    max_scroll_pct              Float32,
    cart_value_max              Float64,
    order_total_max             Float64,
    revenue                     Float64,
    device_type                 LowCardinality(String),
    first_page_type             LowCardinality(String),
    first_page_url              String,
    last_page_url               String,
    referrer_url                String,
    country                     LowCardinality(String),
    region                      String,
    city                        String,
    is_new_visitor              UInt8,
    has_product_view            UInt8,
    has_add_to_cart             UInt8,
    has_checkout_start          UInt8,
    has_purchase                UInt8,
    is_bounce                   UInt8,
    is_cart_abandoned           UInt8,
    is_checkout_abandoned       UInt8,
    purchase_intent_score       Float64 DEFAULT 0,
    purchase_intent_tier        LowCardinality(String) DEFAULT 'cold',
    purchase_intent_reason      String DEFAULT '',
    updated_at                  DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(session_start)
ORDER BY (site_id, session_id);

ALTER TABLE session_features ADD COLUMN IF NOT EXISTS purchase_intent_score Float64 DEFAULT 0;
ALTER TABLE session_features ADD COLUMN IF NOT EXISTS purchase_intent_tier LowCardinality(String) DEFAULT 'cold';
ALTER TABLE session_features ADD COLUMN IF NOT EXISTS purchase_intent_reason String DEFAULT '';

CREATE TABLE IF NOT EXISTS visitor_features
(
    site_id                  LowCardinality(String),
    visitor_id               String,
    first_seen               DateTime64(3, 'UTC'),
    last_seen                DateTime64(3, 'UTC'),
    sessions                 UInt64,
    total_events             UInt64,
    total_duration_sec       UInt64,
    page_views               UInt64,
    product_views            UInt64,
    product_impressions      UInt64,
    add_to_cart_events       UInt64,
    checkout_starts          UInt64,
    purchases                UInt64,
    registration_events      UInt64,
    login_events             UInt64,
    revenue                  Float64,
    avg_session_duration_sec Float64,
    active_days              UInt64,
    is_repeat_visitor        UInt8,
    is_customer              UInt8,
    last_device_type         LowCardinality(String),
    country                  LowCardinality(String),
    engagement_score         Float64,
    buyer_stage              LowCardinality(String),
    purchase_intent_score    Float64 DEFAULT 0,
    purchase_intent_tier     LowCardinality(String) DEFAULT 'cold',
    purchase_intent_reason   String DEFAULT '',
    updated_at               DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (site_id, visitor_id);

ALTER TABLE visitor_features ADD COLUMN IF NOT EXISTS purchase_intent_score Float64 DEFAULT 0;
ALTER TABLE visitor_features ADD COLUMN IF NOT EXISTS purchase_intent_tier LowCardinality(String) DEFAULT 'cold';
ALTER TABLE visitor_features ADD COLUMN IF NOT EXISTS purchase_intent_reason String DEFAULT '';

CREATE TABLE IF NOT EXISTS site_hourly_metrics
(
    site_id                  LowCardinality(String),
    platform                 LowCardinality(String),
    hour_start               DateTime64(3, 'UTC'),
    raw_events               UInt64,
    sessions                 UInt64,
    visitors                 UInt64,
    page_views               UInt64,
    product_views            UInt64,
    product_impressions      UInt64,
    clicks                   UInt64,
    scroll_events            UInt64,
    search_events            UInt64,
    zero_result_searches     UInt64,
    add_to_cart_events       UInt64,
    cart_view_events         UInt64,
    checkout_starts          UInt64,
    purchases                UInt64,
    revenue                  Float64,
    updated_at               DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(hour_start)
ORDER BY (site_id, hour_start);

CREATE TABLE IF NOT EXISTS site_daily_metrics
(
    site_id                       LowCardinality(String),
    platform                      LowCardinality(String),
    metric_date                   Date,
    sessions                      UInt64,
    visitors                      UInt64,
    raw_events                    UInt64,
    page_views                    UInt64,
    product_view_sessions         UInt64,
    add_to_cart_sessions          UInt64,
    checkout_start_sessions       UInt64,
    purchase_sessions             UInt64,
    cart_abandoned_sessions       UInt64,
    checkout_abandoned_sessions   UInt64,
    bounce_sessions               UInt64,
    search_sessions               UInt64,
    zero_result_search_sessions   UInt64,
    registration_sessions         UInt64,
    login_sessions                UInt64,
    newsletter_opt_in_events      UInt64,
    revenue                       Float64,
    avg_events_per_session        Float64,
    avg_session_duration_sec      Float64,
    session_to_purchase_rate_pct  Float64,
    product_to_cart_rate_pct      Float64,
    cart_to_checkout_rate_pct     Float64,
    checkout_to_purchase_rate_pct Float64,
    cart_abandonment_rate_pct     Float64,
    bounce_rate_pct               Float64,
    updated_at                    DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date);

CREATE TABLE IF NOT EXISTS event_daily_metrics
(
    site_id     LowCardinality(String),
    platform    LowCardinality(String),
    metric_date Date,
    event_name  LowCardinality(String),
    event_type  LowCardinality(String),
    events      UInt64,
    sessions    UInt64,
    visitors    UInt64,
    updated_at  DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date, event_name, event_type);

CREATE TABLE IF NOT EXISTS product_daily_metrics
(
    site_id                 LowCardinality(String),
    platform                LowCardinality(String),
    metric_date             Date,
    product_id              String,
    product_name            String,
    product_url             String DEFAULT '',
    product_category        String,
    impressions             UInt64,
    views                   UInt64,
    clicks                  UInt64,
    add_to_cart_events      UInt64,
    remove_from_cart_events UInt64,
    purchase_events         UInt64,
    sessions                UInt64,
    visitors                UInt64,
    revenue                 Float64,
    view_to_cart_rate_pct   Float64,
    cart_to_purchase_rate_pct Float64,
    updated_at              DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date, product_id);

ALTER TABLE product_daily_metrics ADD COLUMN IF NOT EXISTS product_url String DEFAULT '' AFTER product_name;

CREATE TABLE IF NOT EXISTS page_daily_metrics
(
    site_id      LowCardinality(String),
    platform     LowCardinality(String),
    metric_date  Date,
    page_type    LowCardinality(String),
    page_path    String,
    events       UInt64,
    page_views   UInt64,
    sessions     UInt64,
    visitors     UInt64,
    purchases    UInt64,
    revenue      Float64,
    updated_at   DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date, page_type, page_path);

CREATE TABLE IF NOT EXISTS search_daily_metrics
(
    site_id             LowCardinality(String),
    platform            LowCardinality(String),
    metric_date         Date,
    search_term         String,
    search_events       UInt64,
    zero_result_events  UInt64,
    autocomplete_clicks UInt64,
    sessions            UInt64,
    visitors            UInt64,
    updated_at          DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date, search_term);

CREATE TABLE IF NOT EXISTS checkout_method_daily_metrics
(
    site_id      LowCardinality(String),
    platform     LowCardinality(String),
    metric_date  Date,
    method_type  LowCardinality(String),
    method_value String,
    events       UInt64,
    sessions     UInt64,
    visitors     UInt64,
    purchases    UInt64,
    revenue      Float64,
    updated_at   DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date, method_type, method_value);

CREATE TABLE IF NOT EXISTS event_data_quality_daily
(
    site_id                           LowCardinality(String),
    platform                          LowCardinality(String),
    metric_date                       Date,
    total_events                      UInt64,
    missing_session_id_events         UInt64,
    missing_visitor_id_events         UInt64,
    missing_page_url_events           UInt64,
    product_events_missing_product_id UInt64,
    purchase_events_missing_total     UInt64,
    events_with_customer_id           UInt64,
    events_with_location              UInt64,
    add_to_cart_events                UInt64,
    checkout_start_events             UInt64,
    purchase_events                   UInt64,
    updated_at                        DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date);

CREATE TABLE IF NOT EXISTS site_latest_insights
(
    site_id        LowCardinality(String),
    insight_key    String,
    category       LowCardinality(String),
    severity       LowCardinality(String),
    title          String,
    detail         String,
    recommendation String,
    metric_name    String,
    metric_value   Float64,
    window_start   DateTime64(3, 'UTC'),
    window_end     DateTime64(3, 'UTC'),
    updated_at     DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (site_id, insight_key);

CREATE TABLE IF NOT EXISTS product_catalog
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    product_id String,
    product_name String,
    product_url String,
    product_category String,
    impressions UInt64,
    views UInt64,
    clicks UInt64,
    add_to_cart_events UInt64,
    purchase_events UInt64,
    revenue Float64,
    last_seen DateTime64(3, 'UTC'),
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (site_id, product_id);

CREATE TABLE IF NOT EXISTS customer_recommendation_candidates
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    generated_at DateTime64(3, 'UTC'),
    window_start DateTime64(3, 'UTC'),
    window_end DateTime64(3, 'UTC'),
    recommendation_id String,
    visitor_id String,
    customer_id String,
    customer_email String,
    product_id String,
    product_name String,
    product_url String,
    product_category String,
    recommendation_type LowCardinality(String),
    reason String,
    score Float64,
    rec_rank UInt8,
    views UInt64,
    add_to_cart_events UInt64,
    purchase_events UInt64,
    last_signal_at DateTime64(3, 'UTC'),
    status LowCardinality(String) DEFAULT 'ready'
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(generated_at)
ORDER BY (site_id, generated_at, visitor_id, rec_rank, recommendation_id);

CREATE TABLE IF NOT EXISTS recommendation_email_outbox
(
    email_id String,
    campaign_key String,
    tenant_id String,
    site_id LowCardinality(String),
    visitor_id String,
    customer_id String,
    to_email String,
    subject String,
    preview_text String,
    status LowCardinality(String) DEFAULT 'prepared',
    provider LowCardinality(String) DEFAULT 'mock',
    recommendation_ids Array(String),
    product_ids Array(String),
    body_text String,
    body_html String,
    generated_at DateTime64(3, 'UTC'),
    created_at DateTime64(3, 'UTC') DEFAULT now64(3),
    sent_at Nullable(DateTime64(3, 'UTC')),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(created_at)
ORDER BY (site_id, campaign_key, to_email);
