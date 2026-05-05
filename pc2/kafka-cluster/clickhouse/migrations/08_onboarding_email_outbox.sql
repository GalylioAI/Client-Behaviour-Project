USE tracer;

CREATE TABLE IF NOT EXISTS onboarding_email_outbox
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
ORDER BY (site_id, email_id);
