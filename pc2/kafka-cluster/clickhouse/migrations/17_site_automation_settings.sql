USE tracer;

CREATE TABLE IF NOT EXISTS site_automation_settings
(
    site_id String,
    tenant_id String,
    recommendation_intensity UInt8 DEFAULT 5,
    sending_mode LowCardinality(String) DEFAULT 'draft_only',
    max_emails_per_customer_week UInt8 DEFAULT 2,
    cooldown_hours UInt16 DEFAULT 72,
    consent_required UInt8 DEFAULT 1,
    created_at DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, site_id);
