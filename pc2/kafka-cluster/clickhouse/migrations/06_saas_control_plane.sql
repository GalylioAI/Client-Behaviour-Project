USE tracer;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_email String DEFAULT '';

CREATE TABLE IF NOT EXISTS tenant_users
(
    user_id    String,
    tenant_id  String,
    email      String,
    full_name  String,
    role       LowCardinality(String) DEFAULT 'owner',
    status     LowCardinality(String) DEFAULT 'active',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, user_id);
