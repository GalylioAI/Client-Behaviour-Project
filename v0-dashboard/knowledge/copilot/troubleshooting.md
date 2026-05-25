# Troubleshooting Guide

If events are not arriving, check the tracker browser console, FastAPI bridge logs, CORS configuration, allowed origins, public write key, site_id, and platform setting.

If requests return 401 Unauthorized, the tracker is probably missing the public write key, using an old cached tracker bundle, using a revoked key, or sending the wrong site_id.

If a website gets a CORS error, the domain may not be in allowed_origins or the bridge may not be returning the expected Access-Control-Allow-Origin header.

If dashboard numbers look stale, trigger an insights refresh and wait for the analysis job to finish.

If products show generic names, inspect the tracker payload and product_daily_metrics. Product names and URLs should be present in product events.

If sales do not match the ecommerce admin, check purchase_completed events, order_total fields, order IDs, cancelled/refunded/failed order events, and the analysis window.

If recommendations look wrong, inspect product_catalog and customer_recommendation_candidates for pseudo-products such as search, cart, account, or checkout pages.
