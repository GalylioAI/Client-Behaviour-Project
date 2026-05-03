# Layer 2 Behaviour Analysis Pipeline

Layer 1 is the raw event table:

```text
tracer.ecommerce_events
```

Layer 2 is the clean business/feature layer built from those raw events. The
dashboard and future ML jobs should read Layer 2 tables instead of recalculating
everything directly from raw events every time.

## Why Layer 2 Exists

Raw events are very detailed:

```text
page_view
product_view
add_to_cart
checkout_start
purchase_completed
scroll_depth
click
search_query
```

Those events are useful, but the SaaS needs more business-friendly objects:

```text
session
visitor
daily funnel
top products
top pages
top searches
checkout methods
data quality
business insights
```

The pipeline turns raw events into those objects.

## Current Pipeline

File:

```text
pc3/kafka-cluster/airflow/dags/behavior_layer2_pipeline.py
```

It can run in two ways:

```bash
python3 pc3/kafka-cluster/airflow/dags/behavior_layer2_pipeline.py --site-id tdiscount --lookback-hours 24
```

Or from Airflow:

```text
DAG: behavior_layer2_test_refresh
Task: refresh_layer2_tables
```

For now the DAG has no automatic schedule. Trigger it manually for testing.
Later we can schedule it every 5, 15, or 60 minutes depending on cost and
dashboard freshness.

## Tables Created

Schema migration:

```text
pc2/kafka-cluster/clickhouse/migrations/03_layer2_analysis_tables.sql
```

### `session_features`

One row per user session.

Use it for:

```text
session duration
events per session
pages viewed
products viewed
cart intent
checkout intent
purchase flag
bounce sessions
cart abandonment
checkout abandonment
device type
country/city
```

This is the most important table for future ML.

### `visitor_features`

One row per visitor.

Use it for:

```text
repeat visitors
total sessions
total events
total purchases
total revenue
buyer stage
engagement score
last device
country
```

Later, ML can train from this table to predict visitor value or purchase intent.

### `site_hourly_metrics`

One row per site per hour.

Use it for real-time dashboard charts:

```text
events
sessions
visitors
page views
product views
cart events
checkout starts
purchases
revenue
searches
clicks
scrolls
```

### `site_daily_metrics`

One row per site per day.

Use it for executive/business KPIs:

```text
sessions
visitors
purchase sessions
cart abandoned sessions
checkout abandoned sessions
bounce sessions
conversion rates
cart abandonment rate
checkout completion rate
revenue
average session duration
average events per session
```

### `event_daily_metrics`

One row per event type per day.

Use it for:

```text
top event types
event volume changes
tracking checks
```

### `product_daily_metrics`

One row per product per day.

Use it for:

```text
top viewed products
product impressions
product clicks
add-to-cart events
product conversion signals
products with interest but no cart
```

### `page_daily_metrics`

One row per page path/page type per day.

Use it for:

```text
top pages
landing page analysis
page type performance
cart/checkout page monitoring
```

### `search_daily_metrics`

One row per search term per day.

Use it for:

```text
top searches
zero-result searches
autocomplete usage
product demand not served by the catalog
```

### `checkout_method_daily_metrics`

One row per payment/shipping method per day.

Use it for:

```text
payment method usage
shipping method usage
checkout friction monitoring
```

### `event_data_quality_daily`

One row per site per day.

Use it for:

```text
missing session IDs
missing visitor IDs
missing page URLs
product events missing product IDs
purchase events missing order totals
```

This matters before ML. Bad identifiers create bad training data.

### `site_latest_insights`

Human-readable recommendations generated from the metrics.

Examples:

```text
conversion rate insight
checkout completion insight
cart abandonment insight
tracking gap warning
bounce rate insight
dominant device insight
zero-result search insight
product interest without cart insight
visitor ID coverage warning
```

The dashboard can display these as recommendation cards.

### `analysis_runs`

Pipeline run history.

Use it for:

```text
last successful run
failed runs
window analysed
debugging Airflow jobs
```

## Beginner Mental Model

Think of the raw table as a box of receipts.

Layer 2 sorts the receipts into useful reports:

```text
Who visited?
What did they view?
Did they add to cart?
Did they start checkout?
Did they buy?
Where did they drop?
Which products have demand?
Which searches have no result?
Is tracking healthy?
```

ML should come after this layer, not before it.

## Recommended Dashboard Sections

Start with these:

```text
1. Executive overview
2. Funnel
3. Audience/device split
4. Product performance
5. Search demand
6. Checkout methods
7. Page performance
8. Data quality
9. Recommendations
```

## Important Note

The pipeline uses `ReplacingMergeTree`, so rerunning the same window inserts a
newer version of each metric row. Dashboard queries should use `FINAL` while
testing:

```sql
SELECT *
FROM tracer.site_daily_metrics FINAL
WHERE site_id = 'tdiscount'
ORDER BY metric_date DESC;
```

Later, once the dashboard queries are stable, we can optimize this with views or
scheduled table compaction.
