USE tracer;

-- Kafka engine tables do not store data, and ClickHouse cannot ALTER them.
-- Recreate only the stream reader and the materialized view; keep stored events.
DROP VIEW IF EXISTS mv_ecommerce_events;
DROP TABLE IF EXISTS kafka_ecommerce_events;

CREATE TABLE kafka_ecommerce_events
(
    schema_version     Nullable(String),
    event_type         String,
    event_id           String,
    received_at        String,
    session_id         String,
    user_id            Nullable(String),
    site_id            Nullable(String),
    platform           Nullable(String),
    event_name         Nullable(String),
    customer_id        Nullable(String),
    customer_email     Nullable(String),
    page_type          Nullable(String),
    page_url           Nullable(String),
    source             Nullable(String),
    is_unload          Nullable(UInt8),
    timestamp          Nullable(String),
    properties         Nullable(String),
    context            Nullable(String),
    location           Nullable(String),
    raw_event          Nullable(String)
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list          = '192.168.1.105:9092,192.168.1.106:9092,192.168.1.109:9092',
    kafka_topic_list           = 'ecommerce.events',
    kafka_group_name           = 'clickhouse-tdiscount',
    kafka_format               = 'JSONEachRow',
    kafka_num_consumers        = 1,
    kafka_skip_broken_messages = 10;

ALTER TABLE ecommerce_events
    ADD COLUMN IF NOT EXISTS schema_version LowCardinality(String) DEFAULT '1.0' AFTER event_timestamp,
    ADD COLUMN IF NOT EXISTS site_id LowCardinality(String) DEFAULT 'unknown' AFTER event_type,
    ADD COLUMN IF NOT EXISTS platform LowCardinality(String) DEFAULT 'unknown' AFTER site_id,
    ADD COLUMN IF NOT EXISTS properties String DEFAULT '{}' AFTER is_unload,
    ADD COLUMN IF NOT EXISTS context String DEFAULT '{}' AFTER properties,
    ADD COLUMN IF NOT EXISTS location String DEFAULT '{}' AFTER context;

CREATE MATERIALIZED VIEW mv_ecommerce_events TO ecommerce_events AS
SELECT
    coalesce(parseDateTime64BestEffortOrNull(received_at, 3, 'UTC'), now64(3))                      AS received_at,
    coalesce(parseDateTime64BestEffortOrNull(coalesce(timestamp, received_at), 3, 'UTC'), now64(3)) AS event_timestamp,
    coalesce(schema_version, '1.0')                                  AS schema_version,
    coalesce(event_name, event_type, 'unknown')                      AS event_name,
    coalesce(event_type, 'custom')                                   AS event_type,
    coalesce(site_id, 'unknown')                                     AS site_id,
    coalesce(platform, 'unknown')                                    AS platform,
    coalesce(session_id, '')                                         AS session_id,
    user_id                                                          AS visitor_id,
    coalesce(customer_id, '')                                        AS customer_id,
    customer_email,
    page_type,
    page_url,
    coalesce(source, 'client_js')                                    AS source,
    coalesce(is_unload, 0)                                           AS is_unload,
    coalesce(properties, '{}')                                       AS properties,
    coalesce(context, '{}')                                          AS context,
    coalesce(location, '{}')                                         AS location,
    coalesce(raw_event, '{}')                                        AS raw_event
FROM kafka_ecommerce_events;
