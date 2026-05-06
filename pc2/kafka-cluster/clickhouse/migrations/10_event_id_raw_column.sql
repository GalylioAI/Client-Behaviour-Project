USE tracer;

-- Keep a first-class event_id for deduplication, replay checks, and ML datasets.
-- Existing rows can read it from raw_event through the DEFAULT expression.
ALTER TABLE ecommerce_events
    ADD COLUMN IF NOT EXISTS event_id String DEFAULT JSONExtractString(raw_event, 'event_id') AFTER schema_version;

DROP VIEW IF EXISTS mv_ecommerce_events;

CREATE MATERIALIZED VIEW mv_ecommerce_events TO ecommerce_events AS
SELECT
    coalesce(parseDateTime64BestEffortOrNull(kafka_ecommerce_events.received_at, 3, 'UTC'), now64(3))                      AS received_at,
    coalesce(parseDateTime64BestEffortOrNull(coalesce(timestamp, kafka_ecommerce_events.received_at), 3, 'UTC'), now64(3)) AS event_timestamp,
    coalesce(schema_version, '1.0')                                  AS schema_version,
    coalesce(nullIf(event_id, ''), JSONExtractString(coalesce(raw_event, '{}'), 'event_id'), '') AS event_id,
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
