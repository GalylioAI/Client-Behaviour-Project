USE tracer;

CREATE TABLE IF NOT EXISTS tenant_users
(
    user_id       String,
    tenant_id     String,
    email         String,
    full_name     String,
    role          LowCardinality(String) DEFAULT 'owner',
    status        LowCardinality(String) DEFAULT 'active',
    password_hash String DEFAULT '',
    created_at    DateTime64(3, 'UTC') DEFAULT now64(3),
    last_login_at Nullable(DateTime64(3, 'UTC')),
    updated_at    DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, user_id);

ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS password_hash String DEFAULT '';
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS last_login_at Nullable(DateTime64(3, 'UTC'));
