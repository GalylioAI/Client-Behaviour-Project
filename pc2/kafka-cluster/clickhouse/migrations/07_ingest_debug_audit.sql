USE tracer;

CREATE TABLE IF NOT EXISTS event_ingest_audit
(
    audit_id          String,
    received_at       DateTime64(3, 'UTC'),
    worker            String,
    status            LowCardinality(String),
    http_status       UInt16,
    site_id           String,
    platform          LowCardinality(String),
    source            LowCardinality(String),
    client_ip         String,
    origin            String,
    referer           String,
    user_agent        String,
    event_count       UInt32,
    sent_count        UInt32,
    failed_count      UInt32,
    is_unload         UInt8,
    reason            String,
    key_present       UInt8,
    key_prefix        String,
    sample_event_name String,
    sample_event_type String,
    sample_page_url   String,
    created_at        DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
ORDER BY (site_id, received_at, status);
