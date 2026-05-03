CREATE DATABASE IF NOT EXISTS tracer;

USE tracer;

-- 1. Kafka engine table (reads normalized events from Kafka)
CREATE TABLE IF NOT EXISTS kafka_ecommerce_events
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

-- 2. Main storage table
CREATE TABLE IF NOT EXISTS ecommerce_events
(
    received_at        DateTime64(3, 'UTC') DEFAULT now64(3),
    event_timestamp    DateTime64(3, 'UTC'),
    schema_version     LowCardinality(String),
    event_name         LowCardinality(String),
    event_type         LowCardinality(String),
    site_id            LowCardinality(String),
    platform           LowCardinality(String),
    session_id         String,
    visitor_id         Nullable(String),
    customer_id        String,
    customer_email     Nullable(String),
    page_type          Nullable(String),
    page_url           Nullable(String),
    source             LowCardinality(String),
    is_unload          UInt8,
    properties         String,
    context            String,
    location           String,
    raw_event          String,
    event_date         Date  MATERIALIZED toDate(event_timestamp),
    event_hour         UInt8 MATERIALIZED toHour(event_timestamp)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(event_timestamp)
ORDER BY (site_id, event_name, event_timestamp, session_id)
SETTINGS index_granularity = 8192;

-- 3. Materialized view (pipes Kafka -> ecommerce_events)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ecommerce_events TO ecommerce_events AS
SELECT
    parseDateTimeBestEffortOrNow64(received_at)                      AS received_at,
    parseDateTimeBestEffortOrNow64(coalesce(timestamp, received_at)) AS event_timestamp,
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
