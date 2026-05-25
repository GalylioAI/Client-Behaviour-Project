# Data Pipeline And Architecture

The collection layer receives behaviour events from tracker plugins installed on ecommerce websites. Events are sent to the FastAPI bridge and standardized across WordPress/WooCommerce and PrestaShop using shared fields such as site_id, platform, session_id, visitor_id, event_name, product information, order information, page URL, referrer, and raw properties.

The bridge validates tenant/site keys, applies CORS and origin checks, enriches events when possible, and writes accepted events into ClickHouse.

The insights engine is the analysis layer. Airflow runs analysis jobs that transform raw events into business-ready tables such as session features, visitor features, daily metrics, product metrics, funnel metrics, purchase intent scores, recommendation candidates, and email draft outbox rows.

The dashboard should use prepared analytics tables for fast, stable business analytics. It should not query large raw event data for every UI interaction unless debugging.

The refresh button starts an insights refresh in the background. Metrics update after the job finishes and the dashboard reloads.
