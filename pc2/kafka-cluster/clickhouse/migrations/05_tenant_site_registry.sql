USE tracer;

CREATE TABLE IF NOT EXISTS tenants
(
    tenant_id  String,
    name       String,
    plan       LowCardinality(String) DEFAULT 'starter',
    status     LowCardinality(String) DEFAULT 'active',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY tenant_id;

CREATE TABLE IF NOT EXISTS sites
(
    site_id         String,
    tenant_id       String,
    domain          String,
    platform        LowCardinality(String),
    allowed_origins Array(String),
    timezone        String DEFAULT 'UTC',
    status          LowCardinality(String) DEFAULT 'active',
    plan            LowCardinality(String) DEFAULT 'starter',
    created_at      DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at      DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, site_id);

-- Some earlier installs already have a lightweight tracer.sites table used by
-- the dashboard. Extend it in place instead of replacing it, so old rows stay.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS tenant_id String DEFAULT '';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS domain String DEFAULT '';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS platform LowCardinality(String) DEFAULT 'custom';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS allowed_origins Array(String) DEFAULT [];
ALTER TABLE sites ADD COLUMN IF NOT EXISTS timezone String DEFAULT 'UTC';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS status LowCardinality(String) DEFAULT 'active';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS updated_at DateTime64(3, 'UTC') DEFAULT now64(3);

CREATE TABLE IF NOT EXISTS site_keys
(
    key_id     String,
    site_id    String,
    key_type   LowCardinality(String),
    key_prefix String,
    key_hash   FixedString(64),
    status     LowCardinality(String) DEFAULT 'active',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3),
    revoked_at Nullable(DateTime64(3, 'UTC')),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (site_id, key_type, key_id);
