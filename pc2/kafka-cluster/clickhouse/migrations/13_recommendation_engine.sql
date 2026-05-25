USE tracer;

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
