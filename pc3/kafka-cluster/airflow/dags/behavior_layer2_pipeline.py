#!/usr/bin/env python3
"""
Behaviour insights analytics pipeline.

Input:
    tracer.ecommerce_events

Output:
    dashboard-ready ClickHouse tables such as session_features,
    site_daily_metrics, product_daily_metrics, search_daily_metrics, and
    site_latest_insights.

This intentionally does not train ML models yet. The goal is to create clean
feature and metric tables that a future ML pipeline can trust.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

try:
    from airflow import DAG
    from airflow.operators.python import PythonOperator
except Exception:  # Allows local CLI execution without Airflow installed.
    DAG = None
    PythonOperator = None


PIPELINE_NAME = "behavior_layer2_v1"
DEFAULT_CLICKHOUSE_URL = "http://admin:changeme@192.168.1.106:8123/tracer"


SCHEMA_SQL = """
CREATE DATABASE IF NOT EXISTS tracer;
USE tracer;

CREATE TABLE IF NOT EXISTS analysis_runs
(
    run_id String,
    pipeline LowCardinality(String),
    site_id LowCardinality(String),
    window_start DateTime64(3, 'UTC'),
    window_end DateTime64(3, 'UTC'),
    status LowCardinality(String),
    rows_written UInt64 DEFAULT 0,
    message String DEFAULT '',
    started_at DateTime64(3, 'UTC'),
    finished_at Nullable(DateTime64(3, 'UTC')),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(started_at)
ORDER BY (pipeline, site_id, run_id);

CREATE TABLE IF NOT EXISTS session_features
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    session_id String,
    visitor_id String,
    customer_id String,
    customer_email Nullable(String),
    session_start DateTime64(3, 'UTC'),
    session_end DateTime64(3, 'UTC'),
    duration_sec UInt64,
    event_count UInt64,
    page_view_count UInt64,
    product_view_count UInt64,
    product_impression_count UInt64,
    click_count UInt64,
    scroll_event_count UInt64,
    search_event_count UInt64,
    zero_result_search_count UInt64,
    add_to_cart_count UInt64,
    remove_from_cart_count UInt64,
    cart_view_count UInt64,
    checkout_start_count UInt64,
    shipping_selection_count UInt64,
    payment_selection_count UInt64,
    payment_failed_count UInt64,
    purchase_count UInt64,
    registration_count UInt64,
    login_count UInt64,
    newsletter_opt_in_count UInt64,
    unique_pages UInt64,
    unique_products_viewed UInt64,
    unique_products_added_cart UInt64,
    max_scroll_pct Float32,
    cart_value_max Float64,
    order_total_max Float64,
    revenue Float64,
    device_type LowCardinality(String),
    first_page_type LowCardinality(String),
    first_page_url String,
    last_page_url String,
    referrer_url String,
    country LowCardinality(String),
    region String,
    city String,
    is_new_visitor UInt8,
    has_product_view UInt8,
    has_add_to_cart UInt8,
    has_checkout_start UInt8,
    has_purchase UInt8,
    is_bounce UInt8,
    is_cart_abandoned UInt8,
    is_checkout_abandoned UInt8,
    purchase_intent_score Float64 DEFAULT 0,
    purchase_intent_tier LowCardinality(String) DEFAULT 'cold',
    purchase_intent_reason String DEFAULT '',
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(session_start)
ORDER BY (site_id, session_id);

ALTER TABLE session_features ADD COLUMN IF NOT EXISTS purchase_intent_score Float64 DEFAULT 0;
ALTER TABLE session_features ADD COLUMN IF NOT EXISTS purchase_intent_tier LowCardinality(String) DEFAULT 'cold';
ALTER TABLE session_features ADD COLUMN IF NOT EXISTS purchase_intent_reason String DEFAULT '';

CREATE TABLE IF NOT EXISTS visitor_features
(
    site_id LowCardinality(String),
    visitor_id String,
    first_seen DateTime64(3, 'UTC'),
    last_seen DateTime64(3, 'UTC'),
    sessions UInt64,
    total_events UInt64,
    total_duration_sec UInt64,
    page_views UInt64,
    product_views UInt64,
    product_impressions UInt64,
    add_to_cart_events UInt64,
    checkout_starts UInt64,
    purchases UInt64,
    registration_events UInt64,
    login_events UInt64,
    revenue Float64,
    avg_session_duration_sec Float64,
    active_days UInt64,
    is_repeat_visitor UInt8,
    is_customer UInt8,
    last_device_type LowCardinality(String),
    country LowCardinality(String),
    engagement_score Float64,
    buyer_stage LowCardinality(String),
    purchase_intent_score Float64 DEFAULT 0,
    purchase_intent_tier LowCardinality(String) DEFAULT 'cold',
    purchase_intent_reason String DEFAULT '',
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (site_id, visitor_id);

ALTER TABLE visitor_features ADD COLUMN IF NOT EXISTS purchase_intent_score Float64 DEFAULT 0;
ALTER TABLE visitor_features ADD COLUMN IF NOT EXISTS purchase_intent_tier LowCardinality(String) DEFAULT 'cold';
ALTER TABLE visitor_features ADD COLUMN IF NOT EXISTS purchase_intent_reason String DEFAULT '';

CREATE TABLE IF NOT EXISTS site_hourly_metrics
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    hour_start DateTime64(3, 'UTC'),
    raw_events UInt64,
    sessions UInt64,
    visitors UInt64,
    page_views UInt64,
    product_views UInt64,
    product_impressions UInt64,
    clicks UInt64,
    scroll_events UInt64,
    search_events UInt64,
    zero_result_searches UInt64,
    add_to_cart_events UInt64,
    cart_view_events UInt64,
    checkout_starts UInt64,
    purchases UInt64,
    revenue Float64,
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(hour_start)
ORDER BY (site_id, hour_start);

CREATE TABLE IF NOT EXISTS site_daily_metrics
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    metric_date Date,
    sessions UInt64,
    visitors UInt64,
    raw_events UInt64,
    page_views UInt64,
    product_view_sessions UInt64,
    add_to_cart_sessions UInt64,
    checkout_start_sessions UInt64,
    purchase_sessions UInt64,
    cart_abandoned_sessions UInt64,
    checkout_abandoned_sessions UInt64,
    bounce_sessions UInt64,
    search_sessions UInt64,
    zero_result_search_sessions UInt64,
    registration_sessions UInt64,
    login_sessions UInt64,
    newsletter_opt_in_events UInt64,
    revenue Float64,
    avg_events_per_session Float64,
    avg_session_duration_sec Float64,
    session_to_purchase_rate_pct Float64,
    product_to_cart_rate_pct Float64,
    cart_to_checkout_rate_pct Float64,
    checkout_to_purchase_rate_pct Float64,
    cart_abandonment_rate_pct Float64,
    bounce_rate_pct Float64,
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date);

CREATE TABLE IF NOT EXISTS event_daily_metrics
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    metric_date Date,
    event_name LowCardinality(String),
    event_type LowCardinality(String),
    events UInt64,
    sessions UInt64,
    visitors UInt64,
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date, event_name, event_type);

CREATE TABLE IF NOT EXISTS product_daily_metrics
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    metric_date Date,
    product_id String,
    product_name String,
    product_url String DEFAULT '',
    product_category String,
    impressions UInt64,
    views UInt64,
    clicks UInt64,
    add_to_cart_events UInt64,
    remove_from_cart_events UInt64,
    purchase_events UInt64,
    sessions UInt64,
    visitors UInt64,
    revenue Float64,
    view_to_cart_rate_pct Float64,
    cart_to_purchase_rate_pct Float64,
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date, product_id);

ALTER TABLE product_daily_metrics ADD COLUMN IF NOT EXISTS product_url String DEFAULT '' AFTER product_name;

CREATE TABLE IF NOT EXISTS page_daily_metrics
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    metric_date Date,
    page_type LowCardinality(String),
    page_path String,
    events UInt64,
    page_views UInt64,
    sessions UInt64,
    visitors UInt64,
    purchases UInt64,
    revenue Float64,
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date, page_type, page_path);

CREATE TABLE IF NOT EXISTS search_daily_metrics
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    metric_date Date,
    search_term String,
    search_events UInt64,
    zero_result_events UInt64,
    autocomplete_clicks UInt64,
    sessions UInt64,
    visitors UInt64,
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date, search_term);

CREATE TABLE IF NOT EXISTS checkout_method_daily_metrics
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    metric_date Date,
    method_type LowCardinality(String),
    method_value String,
    events UInt64,
    sessions UInt64,
    visitors UInt64,
    purchases UInt64,
    revenue Float64,
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date, method_type, method_value);

CREATE TABLE IF NOT EXISTS event_data_quality_daily
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    metric_date Date,
    total_events UInt64,
    missing_session_id_events UInt64,
    missing_visitor_id_events UInt64,
    missing_page_url_events UInt64,
    product_events_missing_product_id UInt64,
    purchase_events_missing_total UInt64,
    events_with_customer_id UInt64,
    events_with_location UInt64,
    add_to_cart_events UInt64,
    checkout_start_events UInt64,
    purchase_events UInt64,
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(metric_date)
ORDER BY (site_id, metric_date);

CREATE TABLE IF NOT EXISTS site_latest_insights
(
    site_id LowCardinality(String),
    insight_key String,
    category LowCardinality(String),
    severity LowCardinality(String),
    title String,
    detail String,
    recommendation String,
    metric_name String,
    metric_value Float64,
    window_start DateTime64(3, 'UTC'),
    window_end DateTime64(3, 'UTC'),
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (site_id, insight_key);

CREATE TABLE IF NOT EXISTS product_catalog
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    product_id String,
    product_name String,
    product_url String,
    product_category String,
    impressions UInt64,
    views UInt64,
    clicks UInt64,
    add_to_cart_events UInt64,
    purchase_events UInt64,
    revenue Float64,
    last_seen DateTime64(3, 'UTC'),
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (site_id, product_id);

CREATE TABLE IF NOT EXISTS customer_recommendation_candidates
(
    site_id LowCardinality(String),
    platform LowCardinality(String),
    generated_at DateTime64(3, 'UTC'),
    window_start DateTime64(3, 'UTC'),
    window_end DateTime64(3, 'UTC'),
    recommendation_id String,
    visitor_id String,
    customer_id String,
    customer_email String,
    product_id String,
    product_name String,
    product_url String,
    product_category String,
    recommendation_type LowCardinality(String),
    reason String,
    score Float64,
    rec_rank UInt8,
    views UInt64,
    add_to_cart_events UInt64,
    purchase_events UInt64,
    last_signal_at DateTime64(3, 'UTC'),
    status LowCardinality(String) DEFAULT 'ready'
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(generated_at)
ORDER BY (site_id, generated_at, visitor_id, rec_rank, recommendation_id);

CREATE TABLE IF NOT EXISTS recommendation_email_outbox
(
    email_id String,
    campaign_key String,
    tenant_id String,
    site_id LowCardinality(String),
    visitor_id String,
    customer_id String,
    to_email String,
    subject String,
    preview_text String,
    status LowCardinality(String) DEFAULT 'prepared',
    provider LowCardinality(String) DEFAULT 'mock',
    recommendation_ids Array(String),
    product_ids Array(String),
    body_text String,
    body_html String,
    generated_at DateTime64(3, 'UTC'),
    created_at DateTime64(3, 'UTC') DEFAULT now64(3),
    sent_at Nullable(DateTime64(3, 'UTC')),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(created_at)
ORDER BY (site_id, campaign_key, to_email);

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
"""


def quote(value: object) -> str:
    if value is None:
        return "NULL"
    text = str(value).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{text}'"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def format_dt(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def dt_literal(value: datetime) -> str:
    return f"toDateTime64({quote(format_dt(value))}, 3, 'UTC')"


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    cleaned = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(cleaned)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def start_of_utc_day(value: datetime) -> datetime:
    return value.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def split_sql(sql: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    in_single = False
    escaped = False
    for char in sql:
        current.append(char)
        if char == "\\" and in_single:
            escaped = not escaped
            continue
        if char == "'" and not escaped:
            in_single = not in_single
        escaped = False
        if char == ";" and not in_single:
            statement = "".join(current).strip().rstrip(";").strip()
            if statement and not statement.startswith("--"):
                statements.append(statement)
            current = []
    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


@dataclass
class ClickHouseHttpClient:
    endpoint: str
    username: str | None = None
    password: str | None = None

    @classmethod
    def from_env(cls) -> "ClickHouseHttpClient":
        raw_url = (
            os.getenv("CLICKHOUSE_URL")
            or os.getenv("AIRFLOW_CONN_CLICKHOUSE_DEFAULT")
            or DEFAULT_CLICKHOUSE_URL
        )
        parsed = urlparse(raw_url)
        if not parsed.scheme or not parsed.hostname:
            raise ValueError(f"Invalid ClickHouse URL: {raw_url}")

        database = parsed.path.strip("/") or os.getenv("CLICKHOUSE_DATABASE", "tracer")
        port = f":{parsed.port}" if parsed.port else ""
        endpoint = f"{parsed.scheme}://{parsed.hostname}{port}/?{urlencode({'database': database})}"
        username = parsed.username or os.getenv("CLICKHOUSE_USER")
        password = parsed.password or os.getenv("CLICKHOUSE_PASSWORD")
        return cls(endpoint=endpoint, username=username, password=password)

    def execute(self, sql: str) -> str:
        body = sql.strip()
        request = Request(self.endpoint, data=body.encode("utf-8"), method="POST")
        if self.username:
            token = f"{self.username}:{self.password or ''}".encode("utf-8")
            request.add_header("Authorization", "Basic " + base64.b64encode(token).decode("ascii"))
        try:
            with urlopen(request, timeout=120) as response:
                return response.read().decode("utf-8")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"ClickHouse error {exc.code}: {detail}\nSQL:\n{body[:2000]}") from exc

    def query_json(self, sql: str) -> list[dict]:
        text = self.execute(sql.rstrip().rstrip(";") + "\nFORMAT JSONEachRow")
        return [json.loads(line) for line in text.splitlines() if line.strip()]

    def query_scalar(self, sql: str) -> str:
        text = self.execute(sql.rstrip().rstrip(";") + "\nFORMAT TabSeparated")
        return text.strip()

    def insert_json_each_row(self, table: str, rows: Iterable[dict]) -> int:
        payload = [json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in rows]
        if not payload:
            return 0
        self.execute(f"INSERT INTO {table} FORMAT JSONEachRow\n" + "\n".join(payload))
        return len(payload)


def json_text(key: str, source: str = "properties") -> str:
    raw = f"replaceRegexpAll(JSONExtractRaw({source}, {quote(key)}), '^\"|\"$', '')"
    return f"coalesce(nullIf(JSONExtractString({source}, {quote(key)}), ''), nullIf({raw}, ''), '')"


def json_number(key: str, source: str = "properties") -> str:
    return (
        "toFloat64OrZero("
        f"replaceAll(replaceRegexpAll({json_text(key, source)}, '[^0-9,.-]', ''), ',', '.')"
        ")"
    )


PRODUCT_ID = (
    f"coalesce(nullIf({json_text('product_id')}, ''), "
    f"nullIf({json_text('clicked_product_id')}, ''), "
    f"nullIf({json_text('context_product_id')}, ''), '')"
)
PRODUCT_NAME = f"coalesce(nullIf({json_text('product_name')}, ''), nullIf({json_text('name')}, ''), '')"
PRODUCT_NAME_BLOCKLIST = (
    "'accueil', 'home', 'recherche', 'search', 'produit', 'produits', "
    "'product', 'products', 'promos', 'promotion', 'panier', 'cart', "
    "'checkout', 'commande', 'order', 'orders', 'compte', 'account', "
    "'login', 'connexion', 'register', 'inscription', 'contact', "
    "'categorie', 'category', 'wishlist', 'favoris', 'الرئيسية'"
)
PRODUCT_URL_EXPLICIT = (
    f"coalesce(nullIf({json_text('product_url')}, ''), "
    f"nullIf({json_text('product_permalink')}, ''), "
    f"nullIf({json_text('permalink')}, ''), "
    f"nullIf({json_text('href')}, ''), "
    f"nullIf({json_text('url')}, ''), '')"
)
PRODUCT_URL = f"coalesce(nullIf({PRODUCT_URL_EXPLICIT}, ''), nullIf(page_url, ''), '')"
PRODUCT_CATEGORY = (
    f"coalesce(nullIf({json_text('product_category')}, ''), "
    f"nullIf({json_text('category')}, ''), '')"
)
SEARCH_TERM = (
    f"lowerUTF8(trim(coalesce(nullIf({json_text('search_term')}, ''), "
    f"nullIf({json_text('search_query')}, ''), nullIf({json_text('query')}, ''), '')))"
)
REFERRER_URL = (
    f"coalesce(nullIf({json_text('referrer_url')}, ''), "
    f"nullIf({json_text('referrer')}, ''), "
    "nullIf(JSONExtractString(JSONExtractRaw(raw_event, 'page'), 'referrer'), ''), "
    "nullIf(JSONExtractString(JSONExtractRaw(raw_event, 'page'), 'referrer_url'), ''), "
    "nullIf(JSONExtractString(raw_event, 'referrer_url'), ''), "
    "nullIf(JSONExtractString(raw_event, 'referrer'), ''), '')"
)
DEVICE_TYPE = (
    f"lowerUTF8(coalesce(nullIf({json_text('device_type', 'context')}, ''), "
    f"nullIf({json_text('device')}, ''), 'unknown'))"
)
ORDER_TOTAL = (
    f"greatest({json_number('order_total')}, {json_number('cart_total_value')}, "
    f"{json_number('cart_total_after')}, {json_number('cart_total_before')})"
)
ORDER_ID = (
    f"coalesce(nullIf({json_text('order_id')}, ''), "
    f"nullIf({json_text('order_reference')}, ''), "
    f"nullIf({json_text('order_number')}, ''), "
    f"nullIf({json_text('id_order')}, ''), "
    f"nullIf({json_text('transaction_id')}, ''), "
    f"nullIf({json_text('order_key')}, ''), '')"
)
ORDER_REVERSAL_EVENTS = "('order_cancelled', 'order_refunded', 'order_failed')"
CART_VALUE = (
    f"greatest({json_number('cart_total_value')}, {json_number('cart_total_after')}, "
    f"{json_number('cart_total_before')})"
)
SCROLL_PCT = f"greatest({json_number('scroll_percentage')}, {json_number('scroll_depth')})"
NEWSLETTER_OPT_IN = (
    f"(JSONExtractBool(properties, 'newsletter_opted_in') OR "
    f"lowerUTF8({json_text('newsletter_opted_in')}) IN ('true', '1', 'yes'))"
)
IS_NEW_VISITOR = (
    f"(JSONExtractBool(properties, 'is_new_visitor') OR "
    f"lowerUTF8({json_text('is_new_visitor')}) IN ('true', '1', 'yes'))"
)
PAGE_PATH = (
    "coalesce(nullIf(replaceRegexpOne("
    "replaceRegexpOne(ifNull(page_url, ''), '^https?://[^/]+', ''), '\\\\?.*$', ''), ''), '/')"
)


def ensure_schema(client: ClickHouseHttpClient) -> None:
    for statement in split_sql(SCHEMA_SQL):
        client.execute(statement)


def discover_sites(
    client: ClickHouseHttpClient,
    site_id: str | None,
    window_start: datetime,
    window_end: datetime,
) -> list[str]:
    if site_id and site_id not in {"*", "all", "__all__"}:
        return [site_id]

    rows = client.query_json(
        f"""
        SELECT site_id
        FROM ecommerce_events
        WHERE site_id NOT IN ('', 'unknown')
          AND event_timestamp >= {dt_literal(window_start)}
          AND event_timestamp < {dt_literal(window_end)}
        GROUP BY site_id
        ORDER BY site_id
        """
    )
    return [row["site_id"] for row in rows]


def insert_run_status(
    client: ClickHouseHttpClient,
    run_id: str,
    site_id: str,
    window_start: datetime,
    window_end: datetime,
    status: str,
    message: str = "",
    rows_written: int = 0,
    started_at: datetime | None = None,
    finished_at: datetime | None = None,
) -> None:
    started = started_at or utc_now()
    finished_sql = "NULL" if finished_at is None else dt_literal(finished_at)
    client.execute(
        f"""
        INSERT INTO analysis_runs
        (run_id, pipeline, site_id, window_start, window_end, status, rows_written, message, started_at, finished_at)
        VALUES
        (
            {quote(run_id)},
            {quote(PIPELINE_NAME)},
            {quote(site_id)},
            {dt_literal(window_start)},
            {dt_literal(window_end)},
            {quote(status)},
            {rows_written},
            {quote(message[:2000])},
            {dt_literal(started)},
            {finished_sql}
        )
        """
    )


def refresh_session_features(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    client.execute(
        f"""
        INSERT INTO session_features
        (
            site_id,
            platform,
            session_id,
            visitor_id,
            customer_id,
            customer_email,
            session_start,
            session_end,
            duration_sec,
            event_count,
            page_view_count,
            product_view_count,
            product_impression_count,
            click_count,
            scroll_event_count,
            search_event_count,
            zero_result_search_count,
            add_to_cart_count,
            remove_from_cart_count,
            cart_view_count,
            checkout_start_count,
            shipping_selection_count,
            payment_selection_count,
            payment_failed_count,
            purchase_count,
            registration_count,
            login_count,
            newsletter_opt_in_count,
            unique_pages,
            unique_products_viewed,
            unique_products_added_cart,
            max_scroll_pct,
            cart_value_max,
            order_total_max,
            revenue,
            device_type,
            first_page_type,
            first_page_url,
            last_page_url,
            referrer_url,
            country,
            region,
            city,
            is_new_visitor,
            has_product_view,
            has_add_to_cart,
            has_checkout_start,
            has_purchase,
            is_bounce,
            is_cart_abandoned,
            is_checkout_abandoned,
            purchase_intent_score,
            purchase_intent_tier,
            purchase_intent_reason,
            updated_at
        )
        WITH
            reversed_orders AS
            (
                SELECT DISTINCT {ORDER_ID} AS reversed_order_key
                FROM ecommerce_events
                WHERE site_id = {quote(site_id)}
                  AND event_name IN {ORDER_REVERSAL_EVENTS}
                  AND event_timestamp < {dt_literal(end)}
                  AND {ORDER_ID} != ''
            ),
            affected_orders AS
            (
                SELECT DISTINCT {ORDER_ID} AS affected_order_key
                FROM ecommerce_events
                WHERE site_id = {quote(site_id)}
                  AND event_name IN {ORDER_REVERSAL_EVENTS}
                  AND event_timestamp >= {dt_literal(start)}
                  AND event_timestamp < {dt_literal(end)}
                  AND {ORDER_ID} != ''
            )
        SELECT
            site_id,
            coalesce(nullIf(anyLast(platform), ''), 'unknown') AS platform,
            session_key AS session_id,
            coalesce(nullIf(anyLast(visitor_id), ''), '') AS visitor_id,
            coalesce(nullIf(anyLast(customer_id), ''), '') AS customer_id,
            anyLast(customer_email) AS customer_email,
            min(event_timestamp) AS session_start,
            max(event_timestamp) AS session_end,
            toUInt64(greatest(dateDiff('second', min(event_timestamp), max(event_timestamp)), 0)) AS duration_sec,
            count() AS event_count,
            countIf(event_name = 'page_view') AS page_view_count,
            countIf(event_name = 'product_view') AS product_view_count,
            countIf(event_name = 'product_impression') AS product_impression_count,
            countIf(event_name = 'click') AS click_count,
            countIf(event_name = 'scroll_depth') AS scroll_event_count,
            countIf(event_type = 'search' OR positionCaseInsensitive(event_name, 'search') > 0) AS search_event_count,
            countIf(event_name = 'search_zero_results') AS zero_result_search_count,
            countIf(event_name = 'add_to_cart') AS add_to_cart_count,
            countIf(event_name = 'remove_from_cart') AS remove_from_cart_count,
            countIf(event_name = 'cart_view') AS cart_view_count,
            countIf(event_name = 'checkout_start') AS checkout_start_count,
            countIf(event_name = 'checkout_shipping_method_selected') AS shipping_selection_count,
            countIf(event_name = 'checkout_payment_method_selected') AS payment_selection_count,
            countIf(event_name = 'payment_failed') AS payment_failed_count,
            uniqExactIf(purchase_key, valid_purchase_flag = 1 AND purchase_key != '') AS purchase_count,
            countIf(event_name = 'account_registration') AS registration_count,
            countIf(event_name = 'login') AS login_count,
            countIf(newsletter_flag) AS newsletter_opt_in_count,
            uniqExactIf(ifNull(page_url, ''), ifNull(page_url, '') != '') AS unique_pages,
            uniqExactIf(product_key, event_name = 'product_view' AND product_key != '') AS unique_products_viewed,
            uniqExactIf(product_key, event_name = 'add_to_cart' AND product_key != '') AS unique_products_added_cart,
            toFloat32(max(scroll_pct)) AS max_scroll_pct,
            max(cart_value) AS cart_value_max,
            maxIf(order_total_value, valid_purchase_flag = 1) AS order_total_max,
            if(
                purchase_count <= 1,
                order_total_max,
                sumIf(order_total_value, valid_purchase_flag = 1)
            ) AS revenue,
            coalesce(nullIf(argMax(device_key, event_timestamp), ''), 'unknown') AS device_type,
            coalesce(nullIf(argMin(ifNull(page_type, ''), event_timestamp), ''), 'unknown') AS first_page_type,
            coalesce(nullIf(argMin(ifNull(page_url, ''), event_timestamp), ''), '') AS first_page_url,
            coalesce(nullIf(argMax(ifNull(page_url, ''), event_timestamp), ''), '') AS last_page_url,
            coalesce(nullIf(argMin(referrer_key, event_timestamp), ''), '') AS referrer_url,
            coalesce(nullIf(argMax(JSONExtractString(location, 'country'), event_timestamp), ''), 'unknown') AS country,
            coalesce(nullIf(argMax(JSONExtractString(location, 'region'), event_timestamp), ''), '') AS region,
            coalesce(nullIf(argMax(JSONExtractString(location, 'city'), event_timestamp), ''), '') AS city,
            toUInt8(max(new_visitor_flag)) AS is_new_visitor,
            toUInt8(product_view_count > 0) AS has_product_view,
            toUInt8(add_to_cart_count > 0 OR cart_view_count > 0) AS has_add_to_cart,
            toUInt8(checkout_start_count > 0) AS has_checkout_start,
            toUInt8(purchase_count > 0) AS has_purchase,
            toUInt8(page_view_count <= 1 AND duration_sec <= 15) AS is_bounce,
            toUInt8((add_to_cart_count > 0 OR cart_view_count > 0) AND purchase_count = 0) AS is_cart_abandoned,
            toUInt8(checkout_start_count > 0 AND purchase_count = 0) AS is_checkout_abandoned,
            round(
                greatest(
                    0,
                    least(
                        100,
                        if(
                            purchase_count > 0,
                            100,
                            6
                            + least(product_view_count, 6) * 5
                            + least(product_impression_count, 10) * 0.8
                            + least(unique_products_viewed, 5) * 4
                            + least(add_to_cart_count + cart_view_count, 4) * 14
                            + least(checkout_start_count, 1) * 18
                            + least(shipping_selection_count + payment_selection_count, 2) * 7
                            + least(search_event_count, 3) * 4
                            + least(click_count, 12) * 0.8
                            + least(scroll_event_count, 6) * 1.5
                            + least(duration_sec, 420) / 420 * 10
                            + least(event_count, 40) / 40 * 8
                            + if(cart_value_max > 0, least(log(1 + cart_value_max), 6) * 2.5, 0)
                            + if(login_count > 0 OR registration_count > 0, 6, 0)
                            + if(is_new_visitor = 0, 3, 0)
                            - if(remove_from_cart_count > 0, 7, 0)
                            - if(payment_failed_count > 0, 10, 0)
                            - if(zero_result_search_count > 0, 5, 0)
                            - if(page_view_count <= 1 AND duration_sec <= 15, 18, 0)
                        )
                    )
                ),
                2
            ) AS purchase_intent_score,
            multiIf(
                purchase_count > 0, 'converted',
                purchase_intent_score >= 75, 'high',
                purchase_intent_score >= 50, 'medium',
                purchase_intent_score >= 25, 'low',
                'cold'
            ) AS purchase_intent_tier,
            multiIf(
                purchase_count > 0, 'Purchase completed',
                payment_failed_count > 0, 'Payment failed after checkout',
                checkout_start_count > 0 OR payment_selection_count > 0 OR shipping_selection_count > 0, 'Checkout activity',
                add_to_cart_count > 0 OR cart_view_count > 0, 'Cart activity',
                search_event_count > 0 AND product_view_count > 0, 'Search plus product views',
                product_view_count >= 3 OR unique_products_viewed >= 2, 'Multiple product views',
                page_view_count <= 1 AND duration_sec <= 15, 'Short bounce session',
                'Browsing activity'
            ) AS purchase_intent_reason,
            now64(3) AS updated_at
        FROM
        (
            SELECT
                *,
                if(
                    session_id != '',
                    session_id,
                    if(
                        order_key != '',
                        concat('server_order:', order_key),
                        concat('server_purchase:', toString(cityHash64(raw_event, toString(event_timestamp))))
                    )
                ) AS session_key,
                if(
                    event_name = 'purchase_completed',
                    if(
                        order_key != '',
                        order_key,
                        concat('__event__:', toString(cityHash64(raw_event, toString(event_timestamp))))
                    ),
                    ''
                ) AS purchase_key
            FROM
            (
                SELECT
                    *,
                    {PRODUCT_ID} AS product_key,
                    {ORDER_TOTAL} AS order_total_value,
                    {CART_VALUE} AS cart_value,
                    {SCROLL_PCT} AS scroll_pct,
                    {DEVICE_TYPE} AS device_key,
                    {ORDER_ID} AS order_key,
                    toUInt8(
                        event_name = 'purchase_completed'
                        AND (
                            {ORDER_ID} = ''
                            OR {ORDER_ID} NOT IN (SELECT reversed_order_key FROM reversed_orders)
                        )
                    ) AS valid_purchase_flag,
                    {IS_NEW_VISITOR} AS new_visitor_flag,
                    {NEWSLETTER_OPT_IN} AS newsletter_flag,
                    {REFERRER_URL} AS referrer_key
                FROM ecommerce_events
                WHERE site_id = {quote(site_id)}
                  AND (
                      (
                          session_id != ''
                          AND session_id IN
                          (
                              SELECT DISTINCT session_id
                              FROM ecommerce_events
                              WHERE site_id = {quote(site_id)}
                                AND event_timestamp >= {dt_literal(start)}
                                AND event_timestamp < {dt_literal(end)}
                                AND session_id != ''
                          )
                      )
                      OR (
                          event_name = 'purchase_completed'
                          AND event_timestamp >= {dt_literal(start)}
                          AND event_timestamp < {dt_literal(end)}
                      )
                      OR (
                          {ORDER_ID} != ''
                          AND {ORDER_ID} IN (SELECT affected_order_key FROM affected_orders)
                      )
                  )
            )
        )
        GROUP BY site_id, session_key
        """
    )


def refresh_visitor_features(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    client.execute(
        f"""
        INSERT INTO visitor_features
        (
            site_id,
            visitor_id,
            first_seen,
            last_seen,
            sessions,
            total_events,
            total_duration_sec,
            page_views,
            product_views,
            product_impressions,
            add_to_cart_events,
            checkout_starts,
            purchases,
            registration_events,
            login_events,
            revenue,
            avg_session_duration_sec,
            active_days,
            is_repeat_visitor,
            is_customer,
            last_device_type,
            country,
            engagement_score,
            buyer_stage,
            purchase_intent_score,
            purchase_intent_tier,
            purchase_intent_reason,
            updated_at
        )
        SELECT
            site_id,
            visitor_id,
            first_seen,
            last_seen,
            sessions,
            total_events,
            total_duration_sec,
            page_views,
            product_views,
            product_impressions,
            add_to_cart_events,
            checkout_starts,
            purchases,
            registration_events,
            login_events,
            revenue,
            avg_session_duration_sec,
            active_days,
            toUInt8(sessions > 1) AS is_repeat_visitor,
            toUInt8(purchases > 0 OR registration_events > 0) AS is_customer,
            last_device_type,
            country,
            round(
                least(
                    100,
                    log(1 + total_events) * 12
                    + least(product_views, 20) * 2
                    + add_to_cart_events * 12
                    + checkout_starts * 18
                    + purchases * 30
                ),
                2
            ) AS engagement_score,
            multiIf(
                purchases > 0, 'buyer',
                checkout_starts > 0, 'checkout_intent',
                add_to_cart_events > 0, 'cart_intent',
                product_views > 0, 'browser',
                'low_intent'
            ) AS buyer_stage,
            round(
                greatest(
                    0,
                    least(
                        100,
                        if(
                            purchases > 0,
                            100,
                            max_session_purchase_intent_score
                            + least(sessions, 5) * 3
                            + least(active_days, 5) * 2
                            + if(registration_events > 0 OR login_events > 0, 5, 0)
                        )
                    )
                ),
                2
            ) AS purchase_intent_score,
            multiIf(
                purchases > 0, 'converted',
                greatest(
                    0,
                    least(
                        100,
                        max_session_purchase_intent_score
                        + least(sessions, 5) * 3
                        + least(active_days, 5) * 2
                        + if(registration_events > 0 OR login_events > 0, 5, 0)
                    )
                ) >= 75, 'high',
                greatest(
                    0,
                    least(
                        100,
                        max_session_purchase_intent_score
                        + least(sessions, 5) * 3
                        + least(active_days, 5) * 2
                        + if(registration_events > 0 OR login_events > 0, 5, 0)
                    )
                ) >= 50, 'medium',
                greatest(
                    0,
                    least(
                        100,
                        max_session_purchase_intent_score
                        + least(sessions, 5) * 3
                        + least(active_days, 5) * 2
                        + if(registration_events > 0 OR login_events > 0, 5, 0)
                    )
                ) >= 25, 'low',
                'cold'
            ) AS purchase_intent_tier,
            multiIf(
                purchases > 0, 'Purchase completed',
                checkout_starts > 0, 'Checkout activity',
                add_to_cart_events > 0, 'Cart activity',
                product_views >= 3, 'Multiple product views',
                max_session_purchase_intent_score > 0, top_session_purchase_intent_reason,
                'Browsing activity'
            ) AS purchase_intent_reason,
            now64(3) AS updated_at
        FROM
        (
            SELECT
                site_id,
                visitor_id,
                min(session_start) AS first_seen,
                max(session_end) AS last_seen,
                count() AS sessions,
                sum(event_count) AS total_events,
                sum(duration_sec) AS total_duration_sec,
                sum(page_view_count) AS page_views,
                sum(product_view_count) AS product_views,
                sum(product_impression_count) AS product_impressions,
                sum(add_to_cart_count) AS add_to_cart_events,
                sum(checkout_start_count) AS checkout_starts,
                sum(purchase_count) AS purchases,
                sum(registration_count) AS registration_events,
                sum(login_count) AS login_events,
                sum(revenue) AS revenue,
                round(avg(duration_sec), 2) AS avg_session_duration_sec,
                uniqExact(toDate(session_start)) AS active_days,
                coalesce(nullIf(argMax(device_type, session_end), ''), 'unknown') AS last_device_type,
                coalesce(nullIf(argMax(country, session_end), ''), 'unknown') AS country,
                max(purchase_intent_score) AS max_session_purchase_intent_score,
                argMax(purchase_intent_reason, purchase_intent_score) AS top_session_purchase_intent_reason
            FROM session_features FINAL
            WHERE site_id = {quote(site_id)}
              AND visitor_id != ''
              AND visitor_id IN
              (
                  SELECT DISTINCT visitor_id
                  FROM session_features FINAL
                  WHERE site_id = {quote(site_id)}
                    AND session_start >= {dt_literal(start)}
                    AND session_start < {dt_literal(end)}
                    AND visitor_id != ''
              )
            GROUP BY site_id, visitor_id
        )
        """
    )


def refresh_site_hourly_metrics(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    client.execute(
        f"""
        INSERT INTO site_hourly_metrics
        WITH
            reversed_orders AS
            (
                SELECT DISTINCT {ORDER_ID} AS reversed_order_key
                FROM ecommerce_events
                WHERE site_id = {quote(site_id)}
                  AND event_name IN {ORDER_REVERSAL_EVENTS}
                  AND event_timestamp < {dt_literal(end)}
                  AND {ORDER_ID} != ''
            ),
            raw AS
            (
                SELECT
                    site_id,
                    coalesce(nullIf(anyLast(platform), ''), 'unknown') AS platform,
                    toStartOfHour(event_timestamp) AS hour_start,
                    count() AS raw_events,
                    uniqExact(session_id) AS sessions,
                    uniqExact(visitor_id) AS visitors,
                    countIf(event_name = 'page_view') AS page_views,
                    countIf(event_name = 'product_view') AS product_views,
                    countIf(event_name = 'product_impression') AS product_impressions,
                    countIf(event_name = 'click') AS clicks,
                    countIf(event_name = 'scroll_depth') AS scroll_events,
                    countIf(event_type = 'search' OR positionCaseInsensitive(event_name, 'search') > 0) AS search_events,
                    countIf(event_name = 'search_zero_results') AS zero_result_searches,
                    countIf(event_name = 'add_to_cart' OR event_name = 'cart_view') AS add_to_cart_events,
                    countIf(event_name = 'cart_view') AS cart_view_events,
                    countIf(event_name = 'checkout_start') AS checkout_starts
                FROM ecommerce_events
                WHERE site_id = {quote(site_id)}
                  AND event_timestamp >= {dt_literal(start)}
                  AND event_timestamp < {dt_literal(end)}
                GROUP BY site_id, hour_start
            ),
            sales AS
            (
                SELECT
                    site_id,
                    hour_start,
                    count() AS purchases,
                    sum(order_total_value) AS revenue
                FROM
                (
                    SELECT
                        site_id,
                        toStartOfHour(min(event_timestamp)) AS hour_start,
                        purchase_key,
                        max(order_total_value) AS order_total_value
                    FROM
                    (
                        SELECT
                            site_id,
                            event_timestamp,
                            {ORDER_TOTAL} AS order_total_value,
                            if(
                                {ORDER_ID} != '',
                                {ORDER_ID},
                                concat('__event__:', toString(cityHash64(raw_event, toString(event_timestamp))))
                            ) AS purchase_key
                        FROM ecommerce_events
                        WHERE site_id = {quote(site_id)}
                          AND event_name = 'purchase_completed'
                          AND (
                              {ORDER_ID} = ''
                              OR {ORDER_ID} NOT IN (SELECT reversed_order_key FROM reversed_orders)
                          )
                    )
                    GROUP BY site_id, purchase_key
                    HAVING hour_start >= {dt_literal(start)}
                       AND hour_start < {dt_literal(end)}
                )
                GROUP BY site_id, hour_start
            )
        SELECT
            raw.site_id,
            raw.platform,
            raw.hour_start,
            raw.raw_events,
            raw.sessions,
            raw.visitors,
            raw.page_views,
            raw.product_views,
            raw.product_impressions,
            raw.clicks,
            raw.scroll_events,
            raw.search_events,
            raw.zero_result_searches,
            raw.add_to_cart_events,
            raw.cart_view_events,
            raw.checkout_starts,
            toUInt64(ifNull(sales.purchases, 0)) AS purchases,
            toFloat64(ifNull(sales.revenue, 0)) AS revenue,
            now64(3) AS updated_at
        FROM raw
        LEFT JOIN sales USING (site_id, hour_start)
        """
    )


def refresh_site_daily_metrics(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    client.execute(
        f"""
        INSERT INTO site_daily_metrics
        SELECT
            site_id,
            coalesce(nullIf(anyLast(platform), ''), 'unknown') AS platform,
            toDate(session_start) AS metric_date,
            count() AS sessions,
            uniqExact(visitor_id) AS visitors,
            sum(event_count) AS raw_events,
            sum(page_view_count) AS page_views,
            countIf(has_product_view = 1) AS product_view_sessions,
            countIf(has_add_to_cart = 1) AS add_to_cart_sessions,
            countIf(has_checkout_start = 1) AS checkout_start_sessions,
            countIf(has_purchase = 1) AS purchase_sessions,
            countIf(is_cart_abandoned = 1) AS cart_abandoned_sessions,
            countIf(is_checkout_abandoned = 1) AS checkout_abandoned_sessions,
            countIf(is_bounce = 1) AS bounce_sessions,
            countIf(search_event_count > 0) AS search_sessions,
            countIf(zero_result_search_count > 0) AS zero_result_search_sessions,
            countIf(registration_count > 0) AS registration_sessions,
            countIf(login_count > 0) AS login_sessions,
            sum(newsletter_opt_in_count) AS newsletter_opt_in_events,
            sum(revenue) AS revenue,
            round(avg(event_count), 2) AS avg_events_per_session,
            round(avg(duration_sec), 2) AS avg_session_duration_sec,
            round(if(sessions = 0, 0, 100 * purchase_sessions / sessions), 2) AS session_to_purchase_rate_pct,
            round(if(product_view_sessions = 0, 0, 100 * add_to_cart_sessions / product_view_sessions), 2) AS product_to_cart_rate_pct,
            round(if(add_to_cart_sessions = 0, 0, 100 * checkout_start_sessions / add_to_cart_sessions), 2) AS cart_to_checkout_rate_pct,
            round(if(checkout_start_sessions = 0, 0, 100 * purchase_sessions / checkout_start_sessions), 2) AS checkout_to_purchase_rate_pct,
            round(if(add_to_cart_sessions = 0, 0, 100 * cart_abandoned_sessions / add_to_cart_sessions), 2) AS cart_abandonment_rate_pct,
            round(if(sessions = 0, 0, 100 * bounce_sessions / sessions), 2) AS bounce_rate_pct,
            now64(3) AS updated_at
        FROM session_features FINAL
        WHERE site_id = {quote(site_id)}
          AND session_start >= {dt_literal(start)}
          AND session_start < {dt_literal(end)}
        GROUP BY site_id, metric_date
        """
    )


def refresh_event_daily_metrics(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    client.execute(
        f"""
        INSERT INTO event_daily_metrics
        SELECT
            site_id,
            coalesce(nullIf(anyLast(platform), ''), 'unknown') AS platform,
            toDate(event_timestamp) AS metric_date,
            event_name,
            event_type,
            count() AS events,
            uniqExact(session_id) AS sessions,
            uniqExact(visitor_id) AS visitors,
            now64(3) AS updated_at
        FROM ecommerce_events
        WHERE site_id = {quote(site_id)}
          AND event_timestamp >= {dt_literal(start)}
          AND event_timestamp < {dt_literal(end)}
        GROUP BY site_id, metric_date, event_name, event_type
        """
    )


def refresh_product_daily_metrics(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    client.execute(
        f"""
        INSERT INTO product_daily_metrics
        (
            site_id,
            platform,
            metric_date,
            product_id,
            product_name,
            product_url,
            product_category,
            impressions,
            views,
            clicks,
            add_to_cart_events,
            remove_from_cart_events,
            purchase_events,
            sessions,
            visitors,
            revenue,
            view_to_cart_rate_pct,
            cart_to_purchase_rate_pct,
            updated_at
        )
        WITH
            reversed_orders AS
            (
                SELECT DISTINCT {ORDER_ID} AS reversed_order_key
                FROM ecommerce_events
                WHERE site_id = {quote(site_id)}
                  AND event_name IN {ORDER_REVERSAL_EVENTS}
                  AND event_timestamp < {dt_literal(end)}
                  AND {ORDER_ID} != ''
            ),
            {PRODUCT_ID} AS product_key,
            {PRODUCT_NAME} AS product_name_key,
            if(lowerUTF8(trim(product_name_key)) IN ({PRODUCT_NAME_BLOCKLIST}), '', product_name_key) AS product_name_valid_key,
            {PRODUCT_URL_EXPLICIT} AS product_url_explicit_key,
            {PRODUCT_URL} AS product_url_key,
            trim(
                replaceRegexpAll(
                    replaceRegexpAll(
                        replaceRegexpAll(extract(product_url_key, '/([^/?#]+)(?:[?#]|$)'), '\\.html?$', ''),
                        '^\\d+[-_]',
                        ''
                    ),
                    '[-_]+',
                    ' '
                )
            ) AS product_name_from_url_key,
            {PRODUCT_CATEGORY} AS product_category_key,
            {ORDER_TOTAL} AS order_total_value,
            toUInt8(
                event_name = 'purchase_completed'
                AND (
                    {ORDER_ID} = ''
                    OR {ORDER_ID} NOT IN (SELECT reversed_order_key FROM reversed_orders)
                )
            ) AS valid_purchase_flag
        SELECT
            site_id,
            coalesce(nullIf(anyLast(platform), ''), 'unknown') AS platform,
            toDate(event_timestamp) AS metric_date,
            product_key AS product_id,
            coalesce(
                nullIf(argMaxIf(product_name_valid_key, event_timestamp, product_name_valid_key != ''), ''),
                nullIf(argMaxIf(product_name_from_url_key, event_timestamp, product_name_from_url_key != '' AND (event_name = 'product_view' OR product_url_explicit_key != '')), ''),
                nullIf(argMaxIf(product_name_from_url_key, event_timestamp, product_name_from_url_key != ''), ''),
                ''
            ) AS product_name,
            coalesce(
                nullIf(argMaxIf(product_url_key, event_timestamp, product_url_key != '' AND (event_name = 'product_view' OR product_url_explicit_key != '')), ''),
                nullIf(argMaxIf(product_url_key, event_timestamp, product_url_key != ''), ''),
                ''
            ) AS product_url,
            coalesce(nullIf(argMaxIf(product_category_key, event_timestamp, product_category_key != ''), ''), '') AS product_category,
            countIf(event_name = 'product_impression') AS impressions,
            countIf(event_name = 'product_view') AS views,
            countIf(event_name = 'click') AS clicks,
            countIf(event_name = 'add_to_cart') AS add_to_cart_events,
            countIf(event_name = 'remove_from_cart') AS remove_from_cart_events,
            countIf(valid_purchase_flag = 1) AS purchase_events,
            uniqExact(session_id) AS sessions,
            uniqExact(visitor_id) AS visitors,
            sumIf(order_total_value, valid_purchase_flag = 1) AS revenue,
            round(if(views = 0, 0, 100 * add_to_cart_events / views), 2) AS view_to_cart_rate_pct,
            round(if(add_to_cart_events = 0, 0, 100 * purchase_events / add_to_cart_events), 2) AS cart_to_purchase_rate_pct,
            now64(3) AS updated_at
        FROM ecommerce_events
        WHERE site_id = {quote(site_id)}
          AND event_timestamp >= {dt_literal(start)}
          AND event_timestamp < {dt_literal(end)}
          AND product_key != ''
        GROUP BY site_id, metric_date, product_key
        """
    )


def refresh_page_daily_metrics(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    client.execute(
        f"""
        INSERT INTO page_daily_metrics
        WITH
            reversed_orders AS
            (
                SELECT DISTINCT {ORDER_ID} AS reversed_order_key
                FROM ecommerce_events
                WHERE site_id = {quote(site_id)}
                  AND event_name IN {ORDER_REVERSAL_EVENTS}
                  AND event_timestamp < {dt_literal(end)}
                  AND {ORDER_ID} != ''
            ),
            {PAGE_PATH} AS page_path_key,
            {ORDER_TOTAL} AS order_total_value,
            toUInt8(
                event_name = 'purchase_completed'
                AND (
                    {ORDER_ID} = ''
                    OR {ORDER_ID} NOT IN (SELECT reversed_order_key FROM reversed_orders)
                )
            ) AS valid_purchase_flag
        SELECT
            site_id,
            coalesce(nullIf(anyLast(platform), ''), 'unknown') AS platform,
            toDate(event_timestamp) AS metric_date,
            coalesce(nullIf(anyLast(page_type), ''), 'unknown') AS page_type,
            page_path_key AS page_path,
            count() AS events,
            countIf(event_name = 'page_view') AS page_views,
            uniqExact(session_id) AS sessions,
            uniqExact(visitor_id) AS visitors,
            countIf(valid_purchase_flag = 1) AS purchases,
            sumIf(order_total_value, valid_purchase_flag = 1) AS revenue,
            now64(3) AS updated_at
        FROM ecommerce_events
        WHERE site_id = {quote(site_id)}
          AND event_timestamp >= {dt_literal(start)}
          AND event_timestamp < {dt_literal(end)}
          AND page_path_key != ''
        GROUP BY site_id, metric_date, page_path_key
        """
    )


def refresh_search_daily_metrics(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    client.execute(
        f"""
        INSERT INTO search_daily_metrics
        WITH {SEARCH_TERM} AS search_term_key
        SELECT
            site_id,
            coalesce(nullIf(anyLast(platform), ''), 'unknown') AS platform,
            toDate(event_timestamp) AS metric_date,
            search_term_key AS search_term,
            countIf(event_type = 'search' OR positionCaseInsensitive(event_name, 'search') > 0) AS search_events,
            countIf(event_name = 'search_zero_results') AS zero_result_events,
            countIf(event_name = 'search_autocomplete_click') AS autocomplete_clicks,
            uniqExact(session_id) AS sessions,
            uniqExact(visitor_id) AS visitors,
            now64(3) AS updated_at
        FROM ecommerce_events
        WHERE site_id = {quote(site_id)}
          AND event_timestamp >= {dt_literal(start)}
          AND event_timestamp < {dt_literal(end)}
          AND search_term_key != ''
          AND (event_type = 'search' OR positionCaseInsensitive(event_name, 'search') > 0)
        GROUP BY site_id, metric_date, search_term_key
        """
    )


def refresh_checkout_method_daily_metrics(
    client: ClickHouseHttpClient,
    site_id: str,
    start: datetime,
    end: datetime,
) -> None:
    payment_method = json_text("payment_method")
    shipping_method = json_text("shipping_method")
    client.execute(
        f"""
        INSERT INTO checkout_method_daily_metrics
        WITH
            reversed_orders AS
            (
                SELECT DISTINCT {ORDER_ID} AS reversed_order_key
                FROM ecommerce_events
                WHERE site_id = {quote(site_id)}
                  AND event_name IN {ORDER_REVERSAL_EVENTS}
                  AND event_timestamp < {dt_literal(end)}
                  AND {ORDER_ID} != ''
            ),
            {payment_method} AS payment_method_key,
            {shipping_method} AS shipping_method_key,
            {ORDER_TOTAL} AS order_total_value,
            toUInt8(
                event_name = 'purchase_completed'
                AND (
                    {ORDER_ID} = ''
                    OR {ORDER_ID} NOT IN (SELECT reversed_order_key FROM reversed_orders)
                )
            ) AS valid_purchase_flag
        SELECT
            site_id,
            coalesce(nullIf(anyLast(platform), ''), 'unknown') AS platform,
            toDate(event_timestamp) AS metric_date,
            'payment' AS method_type,
            payment_method_key AS method_value,
            count() AS events,
            uniqExact(session_id) AS sessions,
            uniqExact(visitor_id) AS visitors,
            countIf(valid_purchase_flag = 1) AS purchases,
            sumIf(order_total_value, valid_purchase_flag = 1) AS revenue,
            now64(3) AS updated_at
        FROM ecommerce_events
        WHERE site_id = {quote(site_id)}
          AND event_timestamp >= {dt_literal(start)}
          AND event_timestamp < {dt_literal(end)}
          AND payment_method_key != ''
        GROUP BY site_id, metric_date, payment_method_key
        UNION ALL
        SELECT
            site_id,
            coalesce(nullIf(anyLast(platform), ''), 'unknown') AS platform,
            toDate(event_timestamp) AS metric_date,
            'shipping' AS method_type,
            shipping_method_key AS method_value,
            count() AS events,
            uniqExact(session_id) AS sessions,
            uniqExact(visitor_id) AS visitors,
            countIf(valid_purchase_flag = 1) AS purchases,
            sumIf(order_total_value, valid_purchase_flag = 1) AS revenue,
            now64(3) AS updated_at
        FROM ecommerce_events
        WHERE site_id = {quote(site_id)}
          AND event_timestamp >= {dt_literal(start)}
          AND event_timestamp < {dt_literal(end)}
          AND shipping_method_key != ''
        GROUP BY site_id, metric_date, shipping_method_key
        """
    )


def refresh_data_quality_daily(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    client.execute(
        f"""
        INSERT INTO event_data_quality_daily
        WITH
            {PRODUCT_ID} AS product_key,
            {ORDER_TOTAL} AS order_total_value
        SELECT
            site_id,
            coalesce(nullIf(anyLast(platform), ''), 'unknown') AS platform,
            toDate(event_timestamp) AS metric_date,
            count() AS total_events,
            countIf(session_id = '') AS missing_session_id_events,
            countIf(visitor_id IS NULL OR visitor_id = '') AS missing_visitor_id_events,
            countIf(page_url IS NULL OR page_url = '') AS missing_page_url_events,
            countIf(event_type = 'product' AND product_key = '') AS product_events_missing_product_id,
            countIf(event_name = 'purchase_completed' AND order_total_value = 0) AS purchase_events_missing_total,
            countIf(customer_id != '') AS events_with_customer_id,
            countIf(location != '{{}}' AND location != '') AS events_with_location,
            countIf(event_name = 'add_to_cart') AS add_to_cart_events,
            countIf(event_name = 'checkout_start') AS checkout_start_events,
            countIf(event_name = 'purchase_completed') AS purchase_events,
            now64(3) AS updated_at
        FROM ecommerce_events
        WHERE site_id = {quote(site_id)}
          AND event_timestamp >= {dt_literal(start)}
          AND event_timestamp < {dt_literal(end)}
        GROUP BY site_id, metric_date
        """
    )


def refresh_product_catalog(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    client.execute(
        f"""
        INSERT INTO product_catalog
        SELECT
            site_id,
            coalesce(nullIf(argMaxIf(platform, updated_at, platform != ''), ''), 'unknown') AS platform,
            product_id,
            coalesce(nullIf(argMaxIf(product_name, updated_at, product_name != ''), ''), product_id) AS product_name,
            coalesce(nullIf(argMaxIf(product_url, updated_at, product_url != ''), ''), '') AS product_url,
            coalesce(nullIf(argMaxIf(product_category, updated_at, product_category != ''), ''), '') AS product_category,
            sum(impressions) AS impressions,
            sum(views) AS views,
            sum(clicks) AS clicks,
            sum(add_to_cart_events) AS add_to_cart_events,
            sum(purchase_events) AS purchase_events,
            sum(revenue) AS revenue,
            max(toDateTime64(metric_date, 3, 'UTC')) AS last_seen,
            now64(3) AS updated_at
        FROM product_daily_metrics FINAL
        WHERE site_id = {quote(site_id)}
          AND metric_date >= toDate({dt_literal(start)})
          AND metric_date <= toDate({dt_literal(end)})
          AND product_id != ''
        GROUP BY site_id, product_id
        """
    )


def refresh_customer_recommendations(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    client.execute(
        f"""
        INSERT INTO customer_recommendation_candidates
        WITH
            {dt_literal(start)} AS window_start_key,
            {dt_literal(end)} AS window_end_key,
            now64(3) AS generated_at_key
        SELECT
            site_id,
            platform,
            generated_at_key AS generated_at,
            window_start_key AS window_start,
            window_end_key AS window_end,
            concat('rec_', site_id, '_', lower(hex(MD5(visitor_key))), '_', product_id) AS recommendation_id,
            visitor_id,
            customer_id,
            customer_email,
            product_id,
            product_name,
            product_url,
            product_category,
            recommendation_type,
            reason,
            score,
            toUInt8(rec_rank) AS rec_rank,
            views,
            add_to_cart_events,
            purchase_events,
            last_signal_at,
            'ready' AS status
        FROM
        (
            SELECT
                *,
                row_number() OVER (PARTITION BY site_id, visitor_key ORDER BY score DESC, last_signal_at DESC, product_id) AS rec_rank
            FROM
            (
                SELECT
                    journey.site_id AS site_id,
                    coalesce(nullIf(journey.platform, ''), nullIf(catalog.platform, ''), 'unknown') AS platform,
                    journey.visitor_key AS visitor_key,
                    journey.visitor_id AS visitor_id,
                    journey.customer_id AS customer_id,
                    journey.customer_email AS customer_email,
                    journey.product_id AS product_id,
                    coalesce(nullIf(journey.product_name, ''), nullIf(catalog.product_name, ''), journey.product_id) AS product_name,
                    coalesce(nullIf(journey.product_url, ''), nullIf(catalog.product_url, ''), '') AS product_url,
                    coalesce(nullIf(journey.product_category, ''), nullIf(catalog.product_category, ''), '') AS product_category,
                    journey.views AS views,
                    journey.clicks AS clicks,
                    journey.add_to_cart_events AS add_to_cart_events,
                    journey.purchase_events AS purchase_events,
                    journey.last_signal_at AS last_signal_at,
                    multiIf(
                        journey.add_to_cart_events > journey.purchase_events AND journey.add_to_cart_events > 0, 'abandoned_cart',
                        journey.views >= 3, 'repeated_interest',
                        journey.clicks > 0, 'clicked_product',
                        'recent_view'
                    ) AS recommendation_type,
                    multiIf(
                        journey.add_to_cart_events > journey.purchase_events AND journey.add_to_cart_events > 0,
                        concat('Added to cart ', toString(journey.add_to_cart_events), ' time(s) but no matching purchase was observed.'),
                        journey.views >= 3,
                        concat('Viewed ', toString(journey.views), ' time(s), showing repeated interest.'),
                        journey.clicks > 0,
                        'Clicked or interacted with this product during the journey.',
                        'Recently viewed product with active browsing intent.'
                    ) AS reason,
                    round(
                        greatest(
                            1,
                            least(
                                100,
                                (journey.views * 10)
                                + (journey.clicks * 4)
                                + (journey.add_to_cart_events * 35)
                                + if(dateDiff('hour', journey.last_signal_at, window_end_key) <= 24, 15, 0)
                                + if(dateDiff('hour', journey.last_signal_at, window_end_key) <= 72, 8, 0)
                                - (journey.purchase_events * 20)
                            )
                        ),
                        2
                    ) AS score
                FROM
                (
                    SELECT
                        site_id,
                        coalesce(nullIf(anyLast(platform), ''), 'unknown') AS platform,
                        visitor_key,
                        coalesce(nullIf(argMaxIf(visitor_id, event_timestamp, visitor_id != ''), ''), visitor_key) AS visitor_id,
                        coalesce(nullIf(argMaxIf(customer_id, event_timestamp, customer_id != ''), ''), '') AS customer_id,
                        coalesce(nullIf(argMaxIf(ifNull(customer_email, ''), event_timestamp, ifNull(customer_email, '') != ''), ''), '') AS customer_email,
                        product_key AS product_id,
                        coalesce(nullIf(argMaxIf(product_name_valid_key, event_timestamp, product_name_valid_key != ''), ''), '') AS product_name,
                        coalesce(nullIf(argMaxIf(product_url_key, event_timestamp, product_url_key != ''), ''), '') AS product_url,
                        coalesce(nullIf(argMaxIf(product_category_key, event_timestamp, product_category_key != ''), ''), '') AS product_category,
                        countIf(event_name = 'product_view') AS views,
                        countIf(event_name = 'click') AS clicks,
                        countIf(event_name = 'add_to_cart') AS add_to_cart_events,
                        countIf(event_name = 'purchase_completed') AS purchase_events,
                        max(event_timestamp) AS last_signal_at
                    FROM
                    (
                        SELECT
                            *,
                            {PRODUCT_ID} AS product_key,
                            {PRODUCT_NAME} AS product_name_key,
                            if(lowerUTF8(trim(product_name_key)) IN ({PRODUCT_NAME_BLOCKLIST}), '', product_name_key) AS product_name_valid_key,
                            {PRODUCT_URL} AS product_url_key,
                            {PRODUCT_CATEGORY} AS product_category_key,
                            if(
                                visitor_id != '',
                                visitor_id,
                                if(
                                    customer_id != '',
                                    concat('customer:', customer_id),
                                    if(ifNull(customer_email, '') != '', concat('email:', lowerUTF8(ifNull(customer_email, ''))), session_id)
                                )
                            ) AS visitor_key
                        FROM ecommerce_events
                        WHERE site_id = {quote(site_id)}
                          AND event_timestamp >= window_start_key
                          AND event_timestamp < window_end_key
                          AND event_name IN ('product_view', 'add_to_cart', 'click', 'product_quick_view', 'product_review_read', 'product_zoom', 'purchase_completed')
                    )
                    WHERE product_key != ''
                      AND visitor_key != ''
                    GROUP BY site_id, visitor_key, product_key
                ) AS journey
                LEFT JOIN
                (
                    SELECT *
                    FROM product_catalog FINAL
                    WHERE site_id = {quote(site_id)}
                ) AS catalog
                ON journey.site_id = catalog.site_id AND journey.product_id = catalog.product_id
            )
            WHERE score >= 20
              AND product_url != ''
              AND lowerUTF8(trim(product_name)) NOT IN ({PRODUCT_NAME_BLOCKLIST})
        )
        WHERE rec_rank <= 5
        """
    )


def automation_intensity_threshold(level: int) -> int:
    thresholds = {
        1: 88,
        2: 80,
        3: 72,
        4: 64,
        5: 56,
        6: 48,
        7: 40,
        8: 32,
        9: 22,
        10: 0,
    }
    return thresholds.get(max(1, min(int(level or 5), 10)), 56)


def load_automation_settings(client: ClickHouseHttpClient, site_id: str) -> dict:
    rows = client.query_json(
        f"""
        SELECT
            recommendation_intensity,
            sending_mode,
            max_emails_per_customer_week,
            cooldown_hours,
            consent_required
        FROM site_automation_settings FINAL
        WHERE site_id = {quote(site_id)}
        ORDER BY updated_at DESC
        LIMIT 1
        """
    )
    row = rows[0] if rows else {}
    intensity = max(1, min(int(row.get("recommendation_intensity") or 5), 10))
    return {
        "recommendation_intensity": intensity,
        "threshold": automation_intensity_threshold(intensity),
        "sending_mode": row.get("sending_mode") or "draft_only",
        "max_emails_per_customer_week": int(row.get("max_emails_per_customer_week") or 2),
        "cooldown_hours": int(row.get("cooldown_hours") or 72),
        "consent_required": int(row.get("consent_required") or 1),
    }


def refresh_recommendation_email_outbox(client: ClickHouseHttpClient, site_id: str) -> None:
    settings = load_automation_settings(client, site_id)
    intensity = settings["recommendation_intensity"]
    threshold = settings["threshold"]
    abandoned_cart_threshold = max(threshold - 12, 0)
    recommendation_filter = f"""
              AND (
                (recommendation_type = 'abandoned_cart' AND score >= {abandoned_cart_threshold})
                OR ({intensity} >= 4 AND recommendation_type = 'repeated_interest' AND score >= {threshold})
                OR ({intensity} >= 7 AND recommendation_type = 'clicked_product' AND score >= {threshold})
                OR ({intensity} >= 8 AND recommendation_type = 'recent_view' AND score >= {threshold})
              )
    """
    client.execute(
        f"""
        INSERT INTO recommendation_email_outbox
        (
            email_id,
            campaign_key,
            tenant_id,
            site_id,
            visitor_id,
            customer_id,
            to_email,
            subject,
            preview_text,
            status,
            provider,
            recommendation_ids,
            product_ids,
            body_text,
            body_html,
            generated_at,
            created_at,
            updated_at
        )
        WITH
            (
                SELECT max(generated_at)
                FROM customer_recommendation_candidates
                WHERE site_id = {quote(site_id)}
            ) AS latest_generated_at,
            (
                SELECT coalesce(nullIf(anyLast(tenant_id), ''), '')
                FROM sites
                WHERE site_id = {quote(site_id)}
            ) AS tenant_id_key
        SELECT
            concat('rec_email_', site_id, '_', lower(hex(MD5(to_email))), '_', formatDateTime(latest_generated_at, '%Y%m%d')) AS email_id,
            concat('daily_recommendations_', formatDateTime(latest_generated_at, '%Y%m%d')) AS campaign_key,
            tenant_id_key AS tenant_id,
            site_id,
            argMax(visitor_id, score) AS visitor_id,
            argMax(customer_id, score) AS customer_id,
            to_email,
            concat('Products picked for you from ', site_id) AS subject,
            concat('Recommended for you: ', arrayStringConcat(groupArray(product_name), ', ')) AS preview_text,
            'prepared' AS status,
            'mock' AS provider,
            groupArray(recommendation_id) AS recommendation_ids,
            groupArray(product_id) AS product_ids,
            concat(
                'Hi,\\n\\nBased on your recent visit, we picked these products for you:\\n\\n',
                arrayStringConcat(groupArray(concat('- ', product_name, ': ', product_url, ' — ', reason)), '\\n'),
                '\\n\\nThis is a prepared draft. Real sending is disabled until SMTP and consent rules are enabled.'
            ) AS body_text,
            concat(
                '<p>Hi,</p><p>Based on your recent visit, we picked these products for you:</p><ul>',
                arrayStringConcat(groupArray(concat('<li><a href="', product_url, '">', product_name, '</a><br/><small>', reason, '</small></li>')), ''),
                '</ul><p><em>This is a prepared draft. Real sending is disabled until SMTP and consent rules are enabled.</em></p>'
            ) AS body_html,
            latest_generated_at AS generated_at,
            now64(3) AS created_at,
            now64(3) AS updated_at
        FROM
        (
            SELECT
                *,
                customer_email AS to_email
            FROM customer_recommendation_candidates
            WHERE site_id = {quote(site_id)}
              AND generated_at = latest_generated_at
              AND customer_email != ''
              AND position(customer_email, '@') > 1
              AND rec_rank <= 3
              {recommendation_filter}
            ORDER BY to_email, rec_rank ASC, score DESC
        )
        GROUP BY site_id, to_email
        """
    )


def query_latest_daily(client: ClickHouseHttpClient, site_id: str) -> dict | None:
    rows = client.query_json(
        f"""
        SELECT *
        FROM site_daily_metrics FINAL
        WHERE site_id = {quote(site_id)}
        ORDER BY metric_date DESC
        LIMIT 1
        """
    )
    return rows[0] if rows else None


def generate_site_insights(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> int:
    latest = query_latest_daily(client, site_id)
    if not latest:
        return 0

    now = format_dt(utc_now())
    common = {
        "site_id": site_id,
        "window_start": format_dt(start),
        "window_end": format_dt(end),
        "updated_at": now,
    }
    insights: list[dict] = []

    def add(
        key: str,
        category: str,
        severity: str,
        title: str,
        detail: str,
        recommendation: str,
        metric_name: str,
        metric_value: float,
    ) -> None:
        insights.append(
            {
                **common,
                "insight_key": key,
                "category": category,
                "severity": severity,
                "title": title,
                "detail": detail,
                "recommendation": recommendation,
                "metric_name": metric_name,
                "metric_value": float(metric_value or 0),
            }
        )

    sessions = float(latest.get("sessions") or 0)
    purchase_rate = float(latest.get("session_to_purchase_rate_pct") or 0)
    checkout_rate = float(latest.get("checkout_to_purchase_rate_pct") or 0)
    bounce_rate = float(latest.get("bounce_rate_pct") or 0)
    cart_abandonment = float(latest.get("cart_abandonment_rate_pct") or 0)
    add_to_cart_sessions = float(latest.get("add_to_cart_sessions") or 0)
    checkout_sessions = float(latest.get("checkout_start_sessions") or 0)

    if sessions > 0:
        severity = "high" if purchase_rate < 1 else "medium" if purchase_rate < 3 else "info"
        add(
            "conversion_rate",
            "conversion",
            severity,
            "Session to purchase conversion",
            f"{purchase_rate:.2f}% of sessions ended in purchase on the latest analysed day.",
            "Use this as the main business KPI. Split it by device, channel, and product category before changing the store.",
            "session_to_purchase_rate_pct",
            purchase_rate,
        )

    if checkout_sessions > 0:
        severity = "high" if checkout_rate < 30 else "medium" if checkout_rate < 50 else "info"
        add(
            "checkout_completion",
            "checkout",
            severity,
            "Checkout completion",
            f"{checkout_rate:.2f}% of checkout sessions ended in purchase.",
            "If this drops, inspect payment methods, shipping cost surprises, form errors, and trust signals.",
            "checkout_to_purchase_rate_pct",
            checkout_rate,
        )

    if add_to_cart_sessions > 0:
        severity = "high" if cart_abandonment >= 70 else "medium" if cart_abandonment >= 50 else "info"
        add(
            "cart_abandonment",
            "cart",
            severity,
            "Cart abandonment",
            f"{cart_abandonment:.2f}% of cart sessions did not purchase.",
            "Use this for abandoned-cart campaigns and to find products that create intent but do not convert.",
            "cart_abandonment_rate_pct",
            cart_abandonment,
        )

    if add_to_cart_sessions == 0 and checkout_sessions > 0:
        add(
            "tracking_add_to_cart_gap",
            "data_quality",
            "high",
            "Add-to-cart tracking gap",
            "Checkout sessions exist, but no add_to_cart sessions were found in the latest daily metrics.",
            "Check the WordPress/PrestaShop cart tracker selectors. This signal is very important for funnels and future ML.",
            "add_to_cart_sessions",
            0,
        )

    if sessions > 20:
        severity = "medium" if bounce_rate >= 60 else "info"
        add(
            "bounce_rate",
            "engagement",
            severity,
            "Low engagement sessions",
            f"{bounce_rate:.2f}% of sessions were short one-page sessions.",
            "Compare this by landing page. High bounce on product/category pages usually points to weak relevance or slow UX.",
            "bounce_rate_pct",
            bounce_rate,
        )

    device_rows = client.query_json(
        f"""
        SELECT device_type, count() AS sessions
        FROM session_features FINAL
        WHERE site_id = {quote(site_id)}
          AND session_start >= {dt_literal(start)}
          AND session_start < {dt_literal(end)}
        GROUP BY device_type
        ORDER BY sessions DESC
        LIMIT 1
        """
    )
    if device_rows:
        top = device_rows[0]
        share = 100 * float(top["sessions"]) / sessions if sessions else 0
        add(
            "top_device",
            "audience",
            "info",
            "Dominant device type",
            f"{top['device_type']} generated {share:.2f}% of analysed sessions.",
            "Always review conversion and bounce rate by device before deciding where to optimize.",
            "top_device_session_share_pct",
            share,
        )

    search_rows = client.query_json(
        f"""
        SELECT search_term, sum(zero_result_events) AS zero_results
        FROM search_daily_metrics FINAL
        WHERE site_id = {quote(site_id)}
          AND metric_date >= toDate({dt_literal(start)})
          AND metric_date <= toDate({dt_literal(end)})
        GROUP BY search_term
        HAVING zero_results > 0
        ORDER BY zero_results DESC
        LIMIT 1
        """
    )
    if search_rows:
        row = search_rows[0]
        add(
            "zero_result_search",
            "search",
            "medium",
            "Zero-result search demand",
            f"'{row['search_term']}' produced {row['zero_results']} zero-result search events.",
            "Use this to improve catalog naming, synonyms, merchandising, or stock decisions.",
            "zero_result_events",
            float(row["zero_results"]),
        )

    product_rows = client.query_json(
        f"""
        SELECT
            product_id,
            anyLast(product_name) AS product_name,
            sum(views) AS views,
            sum(add_to_cart_events) AS carts
        FROM product_daily_metrics FINAL
        WHERE site_id = {quote(site_id)}
          AND metric_date >= toDate({dt_literal(start)})
          AND metric_date <= toDate({dt_literal(end)})
        GROUP BY product_id
        HAVING views >= 10 AND carts = 0
        ORDER BY views DESC
        LIMIT 1
        """
    )
    if product_rows:
        row = product_rows[0]
        label = row["product_name"] or row["product_id"]
        add(
            "product_interest_no_cart",
            "merchandising",
            "medium",
            "Product interest without cart intent",
            f"{label} had {row['views']} product views but no add-to-cart events in the analysed window.",
            "Check price, stock, product images, delivery promise, and add-to-cart tracking for this product.",
            "product_views_without_cart",
            float(row["views"]),
        )

    quality_rows = client.query_json(
        f"""
        SELECT *
        FROM event_data_quality_daily FINAL
        WHERE site_id = {quote(site_id)}
        ORDER BY metric_date DESC
        LIMIT 1
        """
    )
    if quality_rows:
        quality = quality_rows[0]
        total_events = float(quality.get("total_events") or 0)
        missing_visitor = float(quality.get("missing_visitor_id_events") or 0)
        if total_events and missing_visitor / total_events > 0.05:
            pct = 100 * missing_visitor / total_events
            add(
                "missing_visitor_id",
                "data_quality",
                "medium",
                "Visitor ID coverage",
                f"{pct:.2f}% of events are missing visitor_id.",
                "Improve visitor_id persistence before training ML models, because visitor history depends on it.",
                "missing_visitor_id_pct",
                pct,
            )

    return client.insert_json_each_row("site_latest_insights", insights)


def refresh_site(client: ClickHouseHttpClient, site_id: str, start: datetime, end: datetime) -> None:
    daily_start = start_of_utc_day(start - timedelta(days=7))

    refresh_session_features(client, site_id, start, end)
    refresh_visitor_features(client, site_id, start, end)
    refresh_site_hourly_metrics(client, site_id, start, end)
    refresh_site_daily_metrics(client, site_id, daily_start, end)
    refresh_event_daily_metrics(client, site_id, daily_start, end)
    refresh_product_daily_metrics(client, site_id, daily_start, end)
    refresh_page_daily_metrics(client, site_id, daily_start, end)
    refresh_search_daily_metrics(client, site_id, daily_start, end)
    refresh_checkout_method_daily_metrics(client, site_id, daily_start, end)
    refresh_data_quality_daily(client, site_id, daily_start, end)
    refresh_product_catalog(client, site_id, daily_start, end)
    refresh_customer_recommendations(client, site_id, start, end)
    refresh_recommendation_email_outbox(client, site_id)
    generate_site_insights(client, site_id, daily_start, end)


def run_pipeline(
    site_id: str | None = None,
    lookback_hours: int = 24,
    window_start: str | None = None,
    window_end: str | None = None,
    ensure: bool = True,
) -> dict:
    client = ClickHouseHttpClient.from_env()
    end = parse_dt(window_end) or utc_now()
    start = parse_dt(window_start) or (end - timedelta(hours=lookback_hours))

    if ensure:
        ensure_schema(client)

    sites = discover_sites(client, site_id, start, end)
    result = {
        "pipeline": PIPELINE_NAME,
        "window_start": format_dt(start),
        "window_end": format_dt(end),
        "sites": [],
    }
    if not sites:
        result["message"] = "No sites found in the selected window."
        return result

    for current_site in sites:
        run_id = str(uuid.uuid4())
        started = utc_now()
        insert_run_status(client, run_id, current_site, start, end, "running", started_at=started)
        try:
            refresh_site(client, current_site, start, end)
            finished = utc_now()
            insert_run_status(
                client,
                run_id,
                current_site,
                start,
                end,
                "success",
                rows_written=0,
                started_at=started,
                finished_at=finished,
            )
            result["sites"].append({"site_id": current_site, "status": "success"})
        except Exception as exc:
            finished = utc_now()
            insert_run_status(
                client,
                run_id,
                current_site,
                start,
                end,
                "failed",
                message=str(exc),
                started_at=started,
                finished_at=finished,
            )
            raise

    return result


def airflow_task(**context) -> None:
    params = context.get("params") or {}
    result = run_pipeline(
        site_id=params.get("site_id") or None,
        lookback_hours=int(params.get("lookback_hours") or 24),
        window_start=params.get("window_start") or None,
        window_end=params.get("window_end") or None,
        ensure=str(params.get("ensure_schema", "true")).lower() in {"true", "1", "yes"},
    )
    print(json.dumps(result, indent=2))


if DAG is not None:
    with DAG(
        dag_id="behavior_layer2_test_refresh",
        description="Refresh behaviour insights tables from ClickHouse raw events.",
        start_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
        schedule="*/15 * * * *",
        catchup=False,
        tags=["behaviour", "layer2", "clickhouse", "test"],
        params={
            "site_id": "",
            "lookback_hours": 24,
            "window_start": "",
            "window_end": "",
            "ensure_schema": "true",
        },
    ) as dag:
        PythonOperator(
            task_id="refresh_layer2_tables",
            python_callable=airflow_task,
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Refresh behaviour insights analytics tables.")
    parser.add_argument("--site-id", default=None, help="Site to refresh. Omit or use 'all' for every site in window.")
    parser.add_argument("--lookback-hours", type=int, default=24, help="Lookback window when explicit dates are omitted.")
    parser.add_argument("--window-start", default=None, help="UTC start, e.g. 2026-05-03T00:00:00+00:00.")
    parser.add_argument("--window-end", default=None, help="UTC end, defaults to now.")
    parser.add_argument("--no-ensure-schema", action="store_true", help="Skip CREATE TABLE IF NOT EXISTS.")
    args = parser.parse_args(argv)

    result = run_pipeline(
        site_id=args.site_id,
        lookback_hours=args.lookback_hours,
        window_start=args.window_start,
        window_end=args.window_end,
        ensure=not args.no_ensure_schema,
    )
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
