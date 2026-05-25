from __future__ import annotations

import argparse
import json
import math
import os
import re
import uuid
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import joblib
import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
from mlflow.models import infer_signature
from mlflow.tracking import MlflowClient
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, precision_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

try:
    from xgboost import XGBClassifier
except Exception:  # pragma: no cover - optional dependency fallback.
    XGBClassifier = None  # type: ignore[assignment]

from .common import (
    DVC_WORKSPACE,
    ClickHouseHttpClient,
    dvc_add_and_push,
    format_dt,
    json_default,
    sql_string,
    stable_hash,
    utc_now,
)


USE_CASE = "purchase_intent_abandoned_cart"
MODEL_NAME = "behaviourai_purchase_intent"
RULE_VERSION = "hybrid_rules_v1"
MLFLOW_EXPERIMENT_NAME = "BehaviourAI - Purchase Intent"
TOP_K_VALUES = (20, 50, 100)
VALIDATION_FRACTION = 0.25
MIN_PROMOTION_TEST_POSITIVES = 10

NUMERIC_FEATURES = [
    "duration_sec",
    "event_count",
    "page_view_count",
    "product_view_count",
    "product_impression_count",
    "click_count",
    "scroll_event_count",
    "search_event_count",
    "zero_result_search_count",
    "add_to_cart_count",
    "remove_from_cart_count",
    "cart_view_count",
    "checkout_start_count",
    "shipping_selection_count",
    "payment_selection_count",
    "payment_failed_count",
    "registration_count",
    "login_count",
    "newsletter_opt_in_count",
    "unique_pages",
    "unique_products_viewed",
    "unique_products_added_cart",
    "max_scroll_pct",
    "cart_value_max",
    "is_new_visitor",
    "has_product_view",
    "has_add_to_cart",
    "has_checkout_start",
    "is_bounce",
]

CATEGORICAL_FEATURES = ["platform", "device_type", "first_page_type", "country"]
IDENTITY_COLUMNS = ["site_id", "platform", "session_id", "visitor_id", "customer_id", "customer_email"]
RULE_CONTEXT_FEATURES = ["is_cart_abandoned", "is_checkout_abandoned", "purchase_intent_score"]
TARGET_COLUMN = "label_has_purchase"


SCHEMA_SQL = """
CREATE DATABASE IF NOT EXISTS tracer;
USE tracer;

CREATE TABLE IF NOT EXISTS ml_feature_snapshots
(
    snapshot_id String,
    site_id LowCardinality(String),
    model_use_case LowCardinality(String),
    window_start DateTime64(3, 'UTC'),
    window_end DateTime64(3, 'UTC'),
    row_count UInt64,
    positive_count UInt64,
    negative_count UInt64,
    feature_count UInt32,
    dataset_uri String,
    dataset_hash String,
    dvc_status LowCardinality(String) DEFAULT 'not_configured',
    validation_status LowCardinality(String) DEFAULT 'pending',
    validation_report_id String DEFAULT '',
    validation_report_uri String DEFAULT '',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(created_at)
ORDER BY (model_use_case, site_id, snapshot_id);

CREATE TABLE IF NOT EXISTS ml_validation_reports
(
    report_id String,
    snapshot_id String,
    site_id LowCardinality(String),
    model_use_case LowCardinality(String),
    validation_suite LowCardinality(String),
    status LowCardinality(String),
    critical_issues UInt32,
    warning_issues UInt32,
    report_json String,
    report_uri String DEFAULT '',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (model_use_case, site_id, snapshot_id, report_id);

CREATE TABLE IF NOT EXISTS ml_model_runs
(
    model_run_id String,
    snapshot_id String,
    site_id LowCardinality(String),
    model_use_case LowCardinality(String),
    model_name String,
    model_version String DEFAULT '',
    algorithm LowCardinality(String),
    mlflow_run_id String DEFAULT '',
    mlflow_experiment_id String DEFAULT '',
    model_uri String DEFAULT '',
    status LowCardinality(String),
    promoted UInt8 DEFAULT 0,
    metric_auc Nullable(Float64),
    metric_average_precision Nullable(Float64),
    metric_baseline_average_precision Nullable(Float64),
    metric_precision_top_10_pct Nullable(Float64),
    metric_baseline_precision_top_10_pct Nullable(Float64),
    metric_recall_top_10_pct Nullable(Float64),
    metric_baseline_recall_top_10_pct Nullable(Float64),
    metric_lift_top_10_pct Nullable(Float64),
    metric_baseline_lift_top_10_pct Nullable(Float64),
    metric_precision_top_20 Nullable(Float64),
    metric_recall_top_20 Nullable(Float64),
    metric_lift_top_20 Nullable(Float64),
    metric_baseline_precision_top_20 Nullable(Float64),
    metric_baseline_recall_top_20 Nullable(Float64),
    metric_baseline_lift_top_20 Nullable(Float64),
    metric_precision_top_50 Nullable(Float64),
    metric_recall_top_50 Nullable(Float64),
    metric_lift_top_50 Nullable(Float64),
    metric_baseline_precision_top_50 Nullable(Float64),
    metric_baseline_recall_top_50 Nullable(Float64),
    metric_baseline_lift_top_50 Nullable(Float64),
    metric_precision_top_100 Nullable(Float64),
    metric_recall_top_100 Nullable(Float64),
    metric_lift_top_100 Nullable(Float64),
    metric_baseline_precision_top_100 Nullable(Float64),
    metric_baseline_recall_top_100 Nullable(Float64),
    metric_baseline_lift_top_100 Nullable(Float64),
    metric_brier Nullable(Float64),
    metric_threshold_precision Nullable(Float64),
    metric_threshold_recall Nullable(Float64),
    metric_threshold_f1 Nullable(Float64),
    decision_threshold Nullable(Float64),
    class_imbalance_ratio Nullable(Float64),
    validation_strategy LowCardinality(String) DEFAULT '',
    sampling_strategy LowCardinality(String) DEFAULT '',
    train_rows UInt64,
    test_rows UInt64,
    train_positive_rows UInt64 DEFAULT 0,
    test_positive_rows UInt64 DEFAULT 0,
    feature_count UInt32,
    metrics_json String DEFAULT '',
    message String DEFAULT '',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(created_at)
ORDER BY (model_use_case, site_id, model_run_id);

ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_average_precision Nullable(Float64) AFTER metric_average_precision;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_recall_top_10_pct Nullable(Float64) AFTER metric_baseline_precision_top_10_pct;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_recall_top_10_pct Nullable(Float64) AFTER metric_recall_top_10_pct;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_lift_top_10_pct Nullable(Float64) AFTER metric_baseline_recall_top_10_pct;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_lift_top_10_pct Nullable(Float64) AFTER metric_lift_top_10_pct;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_precision_top_20 Nullable(Float64) AFTER metric_baseline_lift_top_10_pct;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_recall_top_20 Nullable(Float64) AFTER metric_precision_top_20;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_lift_top_20 Nullable(Float64) AFTER metric_recall_top_20;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_precision_top_20 Nullable(Float64) AFTER metric_lift_top_20;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_recall_top_20 Nullable(Float64) AFTER metric_baseline_precision_top_20;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_lift_top_20 Nullable(Float64) AFTER metric_baseline_recall_top_20;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_precision_top_50 Nullable(Float64) AFTER metric_baseline_lift_top_20;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_recall_top_50 Nullable(Float64) AFTER metric_precision_top_50;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_lift_top_50 Nullable(Float64) AFTER metric_recall_top_50;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_precision_top_50 Nullable(Float64) AFTER metric_lift_top_50;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_recall_top_50 Nullable(Float64) AFTER metric_baseline_precision_top_50;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_lift_top_50 Nullable(Float64) AFTER metric_baseline_recall_top_50;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_precision_top_100 Nullable(Float64) AFTER metric_baseline_lift_top_50;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_recall_top_100 Nullable(Float64) AFTER metric_precision_top_100;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_lift_top_100 Nullable(Float64) AFTER metric_recall_top_100;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_precision_top_100 Nullable(Float64) AFTER metric_lift_top_100;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_recall_top_100 Nullable(Float64) AFTER metric_baseline_precision_top_100;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_baseline_lift_top_100 Nullable(Float64) AFTER metric_baseline_recall_top_100;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_brier Nullable(Float64) AFTER metric_baseline_lift_top_100;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_threshold_precision Nullable(Float64) AFTER metric_brier;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_threshold_recall Nullable(Float64) AFTER metric_threshold_precision;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metric_threshold_f1 Nullable(Float64) AFTER metric_threshold_recall;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS decision_threshold Nullable(Float64) AFTER metric_threshold_f1;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS class_imbalance_ratio Nullable(Float64) AFTER decision_threshold;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS validation_strategy LowCardinality(String) DEFAULT '' AFTER class_imbalance_ratio;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS sampling_strategy LowCardinality(String) DEFAULT '' AFTER validation_strategy;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS train_positive_rows UInt64 DEFAULT 0 AFTER test_rows;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS test_positive_rows UInt64 DEFAULT 0 AFTER train_positive_rows;
ALTER TABLE ml_model_runs ADD COLUMN IF NOT EXISTS metrics_json String DEFAULT '' AFTER feature_count;

CREATE TABLE IF NOT EXISTS ml_purchase_intent_predictions
(
    prediction_id String,
    site_id LowCardinality(String),
    platform LowCardinality(String),
    session_id String,
    visitor_id String,
    customer_id String,
    customer_email String,
    model_run_id String,
    snapshot_id String,
    model_name String,
    model_version String DEFAULT '',
    scored_at DateTime64(3, 'UTC'),
    window_start DateTime64(3, 'UTC'),
    window_end DateTime64(3, 'UTC'),
    purchase_probability Float64,
    abandonment_risk Float64,
    rule_baseline_score Float64,
    intent_tier LowCardinality(String),
    recommended_action LowCardinality(String),
    reason String,
    features_json String,
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(scored_at)
ORDER BY (site_id, session_id, model_run_id);

CREATE TABLE IF NOT EXISTS smart_action_candidates
(
    action_id String,
    site_id LowCardinality(String),
    platform LowCardinality(String),
    session_id String,
    visitor_id String,
    customer_id String,
    customer_email String,
    action_type LowCardinality(String),
    channel LowCardinality(String),
    priority LowCardinality(String),
    status LowCardinality(String) DEFAULT 'prepared',
    source LowCardinality(String) DEFAULT 'hybrid_ml_rules',
    model_run_id String DEFAULT '',
    snapshot_id String DEFAULT '',
    prediction_id String DEFAULT '',
    prediction_score Float64,
    rule_score Float64,
    title String,
    reason String,
    payload_json String,
    generated_at DateTime64(3, 'UTC'),
    expires_at Nullable(DateTime64(3, 'UTC')),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(generated_at)
ORDER BY (site_id, status, action_type, visitor_id, session_id, action_id);

CREATE TABLE IF NOT EXISTS ml_rule_decision_audit
(
    decision_id String,
    site_id LowCardinality(String),
    session_id String,
    visitor_id String,
    model_run_id String,
    prediction_id String,
    action_type LowCardinality(String),
    accepted UInt8,
    rule_version String,
    reason String,
    context_json String,
    decided_at DateTime64(3, 'UTC')
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(decided_at)
ORDER BY (site_id, decided_at, session_id, decision_id);

CREATE TABLE IF NOT EXISTS ml_monitoring_reports
(
    report_id String,
    site_id LowCardinality(String),
    model_use_case LowCardinality(String),
    reference_model_run_id String DEFAULT '',
    reference_snapshot_id String DEFAULT '',
    reference_dataset_uri String DEFAULT '',
    current_window_start DateTime64(3, 'UTC'),
    current_window_end DateTime64(3, 'UTC'),
    reference_rows UInt64,
    current_rows UInt64,
    reference_positive_rows UInt64,
    current_positive_rows UInt64,
    drift_status LowCardinality(String),
    drift_score Float64,
    warning_features UInt32,
    drifted_features UInt32,
    deepchecks_status LowCardinality(String),
    deepchecks_report_uri String DEFAULT '',
    monitoring_report_uri String DEFAULT '',
    mlflow_run_id String DEFAULT '',
    action_taken LowCardinality(String),
    retrain_model_run_id String DEFAULT '',
    report_json String,
    created_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (model_use_case, site_id, created_at, report_id);
"""


@dataclass
class PipelineConfig:
    site_id: str | None = None
    lookback_days: int = 30
    min_rows: int = 30
    min_positive: int = 2
    max_actions: int = 100
    action_threshold: float = 0.35
    monitor_lookback_days: int = 7
    retrain_lookback_days: int = 90
    min_monitor_rows: int = 30
    drift_warning_threshold: float = 0.10
    drift_threshold: float = 0.25
    retrain_on_drift: bool = True
    force_retrain: bool = False


def clean_name(value: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_-]+", "_", value.strip().lower())
    clean = re.sub(r"_+", "_", clean).strip("_")
    return clean or "unknown"


def site_model_name(site_id: str) -> str:
    return f"{MODEL_NAME}__site_{clean_name(site_id)}"


def patch_ipython_display_for_deepchecks() -> None:
    try:
        import IPython.core.display as core_display
        from IPython.display import display

        if not hasattr(core_display, "display"):
            core_display.display = display
    except Exception:
        pass


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


def ensure_schema(client: ClickHouseHttpClient) -> None:
    for statement in split_sql(SCHEMA_SQL):
        client.execute(statement)


def list_sites(client: ClickHouseHttpClient, lookback_days: int) -> list[str]:
    rows = client.query_json(
        f"""
        SELECT site_id
        FROM session_features FINAL
        WHERE session_start >= now64(3) - INTERVAL {int(lookback_days)} DAY
          AND site_id != ''
        GROUP BY site_id
        ORDER BY count() DESC
        """
    )
    return [str(row["site_id"]) for row in rows]


def latest_reference_run(client: ClickHouseHttpClient, site_id: str) -> dict[str, Any] | None:
    rows = client.query_json(
        f"""
        SELECT
            model_run_id,
            snapshot_id,
            site_id,
            model_name,
            model_version,
            model_uri,
            promoted,
            status,
            created_at
        FROM ml_model_runs FINAL
        WHERE site_id = {sql_string(site_id)}
          AND model_use_case = {sql_string(USE_CASE)}
          AND status IN ('trained', 'deprecated_leakage_test')
        ORDER BY promoted DESC, created_at DESC
        LIMIT 1
        """
    )
    return rows[0] if rows else None


def snapshot_metadata(client: ClickHouseHttpClient, snapshot_id: str) -> dict[str, Any] | None:
    rows = client.query_json(
        f"""
        SELECT
            snapshot_id,
            site_id,
            dataset_uri,
            dataset_hash,
            row_count,
            positive_count,
            negative_count,
            window_start,
            window_end,
            created_at
        FROM ml_feature_snapshots FINAL
        WHERE snapshot_id = {sql_string(snapshot_id)}
        LIMIT 1
        """
    )
    return rows[0] if rows else None


def load_sessions(client: ClickHouseHttpClient, site_id: str, window_start: datetime, window_end: datetime) -> pd.DataFrame:
    columns = list(dict.fromkeys(IDENTITY_COLUMNS + NUMERIC_FEATURES + RULE_CONTEXT_FEATURES + CATEGORICAL_FEATURES + [
        "session_start",
        "session_end",
        "has_purchase",
        "purchase_count",
    ]))
    select_columns = ",\n            ".join(columns)
    df = client.query_df(
        f"""
        SELECT
            {select_columns},
            toUInt8(has_purchase) AS {TARGET_COLUMN}
        FROM session_features FINAL
        WHERE site_id = {sql_string(site_id)}
          AND session_start >= toDateTime64({sql_string(format_dt(window_start))}, 3, 'UTC')
          AND session_start < toDateTime64({sql_string(format_dt(window_end))}, 3, 'UTC')
          AND session_id != ''
        """
    )
    for column in NUMERIC_FEATURES + RULE_CONTEXT_FEATURES:
        if column not in df.columns:
            df[column] = 0
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0)
    for column in CATEGORICAL_FEATURES + IDENTITY_COLUMNS:
        if column not in df.columns:
            df[column] = ""
        df[column] = df[column].fillna("").astype(str)
    if TARGET_COLUMN not in df.columns:
        df[TARGET_COLUMN] = 0
    df[TARGET_COLUMN] = pd.to_numeric(df[TARGET_COLUMN], errors="coerce").fillna(0).astype(int)
    for column in ["session_start", "session_end"]:
        if column not in df.columns:
            df[column] = pd.NaT
        df[column] = pd.to_datetime(df[column], utc=True, errors="coerce")
    return df


def export_snapshot(df: pd.DataFrame, site_id: str, window_start: datetime, window_end: datetime) -> dict[str, Any]:
    created = utc_now()
    safe_site = clean_name(site_id)
    timestamp = created.strftime("%Y%m%dT%H%M%SZ")
    snapshot_id = f"{safe_site}__{USE_CASE}__snapshot__{timestamp}__{uuid.uuid4().hex[:8]}"
    dataset_name = f"site={safe_site}/use_case={USE_CASE}/date={created.strftime('%Y-%m-%d')}/snapshot={snapshot_id}"
    snapshot_dir = DVC_WORKSPACE / "datasets" / f"site={safe_site}" / f"use_case={USE_CASE}" / f"date={created.strftime('%Y-%m-%d')}" / f"snapshot={snapshot_id}"
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    dataset_path = snapshot_dir / "training.parquet"
    metadata_path = snapshot_dir / "metadata.json"

    df.to_parquet(dataset_path, index=False)
    metadata = {
        "snapshot_id": snapshot_id,
        "site_id": site_id,
        "site_slug": safe_site,
        "model_use_case": USE_CASE,
        "model_name": site_model_name(site_id),
        "dataset_name": dataset_name,
        "window_start": format_dt(window_start),
        "window_end": format_dt(window_end),
        "row_count": int(len(df)),
        "positive_count": int(df[TARGET_COLUMN].sum()),
        "negative_count": int(len(df) - df[TARGET_COLUMN].sum()),
        "feature_count": len(NUMERIC_FEATURES) + len(CATEGORICAL_FEATURES),
        "dataset_hash": stable_hash(dataset_path),
        "created_at": format_dt(created),
    }
    metadata_path.write_text(json.dumps(metadata, indent=2, default=json_default), encoding="utf-8")
    dvc_status, dvc_detail = dvc_add_and_push(snapshot_dir)
    metadata["dataset_uri"] = str(dataset_path)
    metadata["dvc_status"] = dvc_status
    metadata["dvc_detail"] = dvc_detail[-1000:]
    metadata_path.write_text(json.dumps(metadata, indent=2, default=json_default), encoding="utf-8")
    return metadata


def validate_snapshot(df: pd.DataFrame, metadata: dict[str, Any], config: PipelineConfig) -> dict[str, Any]:
    critical: list[str] = []
    warnings: list[str] = []

    row_count = int(len(df))
    positive_count = int(df[TARGET_COLUMN].sum()) if TARGET_COLUMN in df else 0
    negative_count = row_count - positive_count

    if row_count < config.min_rows:
        critical.append(f"Only {row_count} rows available; minimum is {config.min_rows}.")
    if positive_count < config.min_positive:
        critical.append(f"Only {positive_count} purchase sessions available; minimum is {config.min_positive}.")
    if negative_count < config.min_positive:
        critical.append(f"Only {negative_count} non-purchase sessions available; minimum is {config.min_positive}.")
    duplicate_sessions = int(df["session_id"].duplicated().sum()) if "session_id" in df else 0
    if duplicate_sessions:
        critical.append(f"{duplicate_sessions} duplicate session_id rows found in feature snapshot.")

    missing_summary: dict[str, float] = {}
    for column in IDENTITY_COLUMNS + NUMERIC_FEATURES + RULE_CONTEXT_FEATURES + CATEGORICAL_FEATURES:
        if column in df:
            missing_rate = float(df[column].isna().mean())
            missing_summary[column] = missing_rate
            if missing_rate > 0.5:
                warnings.append(f"{column} missing rate is {missing_rate:.1%}.")

    deepchecks_status = "not_available"
    deepchecks_message = ""
    try:
        patch_ipython_display_for_deepchecks()
        from deepchecks.tabular import Dataset
        from deepchecks.tabular.suites import data_integrity

        sample = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES + [TARGET_COLUMN]].copy()
        dataset = Dataset(sample, label=TARGET_COLUMN, cat_features=CATEGORICAL_FEATURES)
        result = data_integrity().run(dataset)
        deepchecks_status = "completed"
        deepchecks_message = str(result)[:3000]
    except Exception as exc:
        deepchecks_status = "failed"
        deepchecks_message = f"{type(exc).__name__}: {exc}"
        warnings.append("Deepchecks could not complete; custom validation was used as the gate.")

    status = "passed" if not critical else "failed"
    report_id = f"val_{metadata['snapshot_id']}_{uuid.uuid4().hex[:8]}"
    report = {
        "report_id": report_id,
        "snapshot_id": metadata["snapshot_id"],
        "site_id": metadata["site_id"],
        "status": status,
        "critical": critical,
        "warnings": warnings,
        "missing_summary": missing_summary,
        "deepchecks_status": deepchecks_status,
        "deepchecks_message": deepchecks_message,
        "created_at": format_dt(utc_now()),
    }
    report_path = Path(metadata["dataset_uri"]).parent / "validation_report.json"
    report_path.write_text(json.dumps(report, indent=2, default=json_default), encoding="utf-8")
    report["report_uri"] = str(report_path)
    return report


def insert_snapshot_and_report(client: ClickHouseHttpClient, metadata: dict[str, Any], report: dict[str, Any]) -> None:
    now = format_dt(utc_now())
    client.insert_json_each_row(
        "ml_feature_snapshots",
        [
            {
                "snapshot_id": metadata["snapshot_id"],
                "site_id": metadata["site_id"],
                "model_use_case": USE_CASE,
                "window_start": metadata["window_start"],
                "window_end": metadata["window_end"],
                "row_count": metadata["row_count"],
                "positive_count": metadata["positive_count"],
                "negative_count": metadata["negative_count"],
                "feature_count": metadata["feature_count"],
                "dataset_uri": metadata["dataset_uri"],
                "dataset_hash": metadata["dataset_hash"],
                "dvc_status": metadata["dvc_status"],
                "validation_status": report["status"],
                "validation_report_id": report["report_id"],
                "validation_report_uri": report["report_uri"],
                "created_at": metadata["created_at"],
                "updated_at": now,
            }
        ],
    )
    client.insert_json_each_row(
        "ml_validation_reports",
        [
            {
                "report_id": report["report_id"],
                "snapshot_id": metadata["snapshot_id"],
                "site_id": metadata["site_id"],
                "model_use_case": USE_CASE,
                "validation_suite": "deepchecks_plus_custom_v1",
                "status": report["status"],
                "critical_issues": len(report["critical"]),
                "warning_issues": len(report["warnings"]),
                "report_json": json.dumps(report, default=json_default, separators=(",", ":")),
                "report_uri": report["report_uri"],
                "created_at": report["created_at"],
            }
        ],
    )


def build_model(row_count: int, positive_count: int, class_imbalance_ratio: float) -> tuple[str, Any]:
    if positive_count <= 0 or positive_count >= row_count:
        return "dummy", DummyClassifier(strategy="prior")
    if XGBClassifier is not None and row_count >= 100 and positive_count >= 5:
        model = XGBClassifier(
            n_estimators=240,
            max_depth=3,
            learning_rate=0.06,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="logloss",
            tree_method="hist",
            scale_pos_weight=max(1.0, class_imbalance_ratio),
            max_delta_step=1,
            random_state=42,
        )
        return "xgboost", model
    return "logistic_regression", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)


def make_pipeline(algorithm: str, model: Any) -> Pipeline:
    numeric_pipe = Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())])
    categorical_pipe = Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))])
    preprocessor = ColumnTransformer(
        [
            ("num", numeric_pipe, NUMERIC_FEATURES),
            ("cat", categorical_pipe, CATEGORICAL_FEATURES),
        ],
        remainder="drop",
    )
    return Pipeline([("preprocess", preprocessor), ("model", model)])


def precision_at_top_fraction(y_true: np.ndarray, scores: np.ndarray, fraction: float = 0.1) -> float | None:
    if len(y_true) == 0:
        return None
    top_n = max(1, int(math.ceil(len(y_true) * fraction)))
    indices = np.argsort(scores)[::-1][:top_n]
    return float(precision_score(y_true[indices], np.ones(len(indices)), zero_division=0))


def safe_divide(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    return float(numerator / denominator)


def top_n_ranking_metrics(y_true: np.ndarray, scores: np.ndarray, n: int) -> dict[str, float | None]:
    if len(y_true) == 0:
        return {"precision": None, "recall": None, "lift": None}
    y_true = np.asarray(y_true).astype(int)
    scores = np.asarray(scores, dtype=float)
    top_n = min(max(1, int(n)), len(y_true))
    positives = int(y_true.sum())
    base_rate = positives / len(y_true) if len(y_true) else 0
    indices = np.argsort(scores)[::-1][:top_n]
    captured = int(y_true[indices].sum())
    precision = captured / top_n
    recall = safe_divide(captured, positives)
    lift = safe_divide(precision, base_rate)
    return {"precision": float(precision), "recall": recall, "lift": lift}


def top_fraction_ranking_metrics(y_true: np.ndarray, scores: np.ndarray, fraction: float) -> dict[str, float | None]:
    top_n = max(1, int(math.ceil(len(y_true) * fraction)))
    return top_n_ranking_metrics(y_true, scores, top_n)


def threshold_metrics(y_true: np.ndarray, scores: np.ndarray, threshold: float) -> dict[str, float | int]:
    y_true = np.asarray(y_true).astype(int)
    scores = np.asarray(scores, dtype=float)
    predicted = scores >= threshold
    tp = int(((predicted == 1) & (y_true == 1)).sum())
    fp = int(((predicted == 1) & (y_true == 0)).sum())
    fn = int(((predicted == 0) & (y_true == 1)).sum())
    tn = int(((predicted == 0) & (y_true == 0)).sum())
    precision = safe_divide(tp, tp + fp) or 0.0
    recall = safe_divide(tp, tp + fn) or 0.0
    f1 = safe_divide(2 * precision * recall, precision + recall) or 0.0
    return {
        "threshold": float(threshold),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "predicted_positive": int(predicted.sum()),
    }


def select_decision_threshold(y_true: np.ndarray, scores: np.ndarray, fallback: float) -> tuple[float, dict[str, float | int]]:
    y_true = np.asarray(y_true).astype(int)
    scores = np.asarray(scores, dtype=float)
    if len(y_true) == 0 or y_true.sum() == 0:
        metrics = threshold_metrics(y_true, scores, fallback)
        return float(fallback), metrics

    candidates = set(float(value) for value in np.quantile(scores, np.linspace(0.50, 0.995, 80)))
    candidates.update(float(value) for value in np.unique(scores))
    candidates.add(float(fallback))

    best_threshold = float(fallback)
    best_metrics = threshold_metrics(y_true, scores, best_threshold)
    for threshold in sorted(candidates):
        current = threshold_metrics(y_true, scores, threshold)
        best_key = (float(best_metrics["f1"]), float(best_metrics["precision"]), float(best_metrics["recall"]), best_threshold)
        current_key = (float(current["f1"]), float(current["precision"]), float(current["recall"]), float(threshold))
        if current_key > best_key:
            best_threshold = float(threshold)
            best_metrics = current
    return best_threshold, best_metrics


def chronological_train_test_split(df: pd.DataFrame, y: np.ndarray, config: PipelineConfig) -> tuple[np.ndarray, np.ndarray, str]:
    row_count = len(df)
    positives = int(y.sum())
    negatives = row_count - positives
    if row_count < 10 or positives == 0 or negatives == 0:
        indices = np.arange(row_count)
        return indices, indices, "full_snapshot_no_holdout"

    ordered_indices = df.sort_values("session_start", kind="mergesort").index.to_numpy()
    ordered_y = y[ordered_indices]
    min_test_positive = min(max(1, positives // 5), max(1, positives - 1), max(1, config.min_positive))
    min_train_positive = min(max(1, config.min_positive), max(1, positives - min_test_positive))
    target_test_rows = max(1, int(math.ceil(row_count * VALIDATION_FRACTION)))
    preferred_split = max(1, row_count - target_test_rows)

    for split_index in range(preferred_split, 0, -1):
        train_y = ordered_y[:split_index]
        test_y = ordered_y[split_index:]
        train_pos = int(train_y.sum())
        test_pos = int(test_y.sum())
        train_neg = len(train_y) - train_pos
        test_neg = len(test_y) - test_pos
        if train_pos >= min_train_positive and test_pos >= min_test_positive and train_neg > 0 and test_neg > 0:
            return ordered_indices[:split_index], ordered_indices[split_index:], "chronological_holdout"

    stratify = y if len(np.unique(y)) == 2 and min(np.bincount(y)) >= 2 else None
    train_idx, test_idx = train_test_split(
        np.arange(row_count),
        test_size=VALIDATION_FRACTION,
        random_state=42,
        stratify=stratify,
    )
    return np.asarray(train_idx), np.asarray(test_idx), "stratified_random_fallback"


def ranking_metric_bundle(y_true: np.ndarray, scores: np.ndarray, prefix: str = "") -> dict[str, float | None]:
    metrics: dict[str, float | None] = {}
    top_10_pct = top_fraction_ranking_metrics(y_true, scores, 0.10)
    metrics[f"{prefix}precision_top_10_pct"] = top_10_pct["precision"]
    metrics[f"{prefix}recall_top_10_pct"] = top_10_pct["recall"]
    metrics[f"{prefix}lift_top_10_pct"] = top_10_pct["lift"]
    for top_k in TOP_K_VALUES:
        current = top_n_ranking_metrics(y_true, scores, top_k)
        metrics[f"{prefix}precision_top_{top_k}"] = current["precision"]
        metrics[f"{prefix}recall_top_{top_k}"] = current["recall"]
        metrics[f"{prefix}lift_top_{top_k}"] = current["lift"]
    return metrics


def clean_metric_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (np.integer, np.floating)):
        value = value.item()
    if isinstance(value, float) and not np.isfinite(value):
        return None
    return value


def serializable_metrics(metrics: dict[str, Any]) -> dict[str, Any]:
    return {key: clean_metric_value(value) for key, value in metrics.items()}


def feature_schema_payload(metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "site_id": metadata["site_id"],
        "model_name": metadata["model_name"],
        "model_use_case": USE_CASE,
        "dataset_name": metadata["dataset_name"],
        "dataset_hash": metadata["dataset_hash"],
        "target": TARGET_COLUMN,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "rule_context_features_not_used_by_model": RULE_CONTEXT_FEATURES,
        "identity_columns_not_used_by_model": IDENTITY_COLUMNS,
        "feature_count": len(NUMERIC_FEATURES) + len(CATEGORICAL_FEATURES),
        "notes": [
            "The Layer 2 purchase_intent_score is not used as an ML feature because it can encode purchase outcome.",
            "Rule context fields are logged for decision comparison but excluded from the fitted model.",
        ],
    }


def feature_importance_frame(pipeline: Pipeline, algorithm: str) -> pd.DataFrame:
    try:
        feature_names = list(pipeline.named_steps["preprocess"].get_feature_names_out())
        model = pipeline.named_steps["model"]
        if hasattr(model, "feature_importances_"):
            values = np.asarray(model.feature_importances_, dtype=float)
            metric_name = "gain_importance"
        elif hasattr(model, "coef_"):
            values = np.asarray(model.coef_).reshape(-1)
            metric_name = "coefficient"
        else:
            return pd.DataFrame(columns=["feature", "importance", "abs_importance", "metric", "algorithm"])
        size = min(len(feature_names), len(values))
        frame = pd.DataFrame(
            {
                "feature": feature_names[:size],
                "importance": values[:size],
                "abs_importance": np.abs(values[:size]),
                "metric": metric_name,
                "algorithm": algorithm,
            }
        )
        return frame.sort_values("abs_importance", ascending=False).reset_index(drop=True)
    except Exception:
        return pd.DataFrame(columns=["feature", "importance", "abs_importance", "metric", "algorithm"])


def top_k_report_frame(metrics: dict[str, Any]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    rows.append(
        {
            "bucket": "top_10_pct",
            "ml_precision": metrics.get("precision_top_10_pct"),
            "ml_recall": metrics.get("recall_top_10_pct"),
            "ml_lift": metrics.get("lift_top_10_pct"),
            "rule_precision": metrics.get("baseline_precision_top_10_pct"),
            "rule_recall": metrics.get("baseline_recall_top_10_pct"),
            "rule_lift": metrics.get("baseline_lift_top_10_pct"),
        }
    )
    for top_k in TOP_K_VALUES:
        rows.append(
            {
                "bucket": f"top_{top_k}",
                "ml_precision": metrics.get(f"precision_top_{top_k}"),
                "ml_recall": metrics.get(f"recall_top_{top_k}"),
                "ml_lift": metrics.get(f"lift_top_{top_k}"),
                "rule_precision": metrics.get(f"baseline_precision_top_{top_k}"),
                "rule_recall": metrics.get(f"baseline_recall_top_{top_k}"),
                "rule_lift": metrics.get(f"baseline_lift_top_{top_k}"),
            }
        )
    return pd.DataFrame(rows)


def validation_predictions_frame(
    df_model: pd.DataFrame,
    test_idx: np.ndarray,
    y_test: np.ndarray,
    probabilities: np.ndarray,
    rule_test: np.ndarray,
    threshold: float,
) -> pd.DataFrame:
    columns = [
        "site_id",
        "session_id",
        "visitor_id",
        "customer_id",
        "customer_email",
        "session_start",
        "session_end",
        "has_add_to_cart",
        "has_checkout_start",
        "purchase_count",
    ]
    available = [column for column in columns if column in df_model.columns]
    frame = df_model.iloc[test_idx][available].copy()
    frame["actual_purchase"] = y_test
    frame["ml_purchase_probability"] = probabilities
    frame["rule_baseline_score"] = rule_test
    frame["selected_threshold"] = threshold
    frame["ml_predicted_positive"] = probabilities >= threshold
    frame["ml_rank"] = pd.Series(probabilities).rank(method="first", ascending=False).astype(int).to_numpy()
    frame["rule_rank"] = pd.Series(rule_test).rank(method="first", ascending=False).astype(int).to_numpy()
    return frame.sort_values("ml_purchase_probability", ascending=False).reset_index(drop=True)


def build_evaluation_report(
    metadata: dict[str, Any],
    model_run_id: str,
    algorithm: str,
    model_version: str,
    metrics: dict[str, Any],
    validation_strategy: str,
    sampling_strategy: str,
    promoted: int,
    quality_warnings: list[str],
    train_rows: int,
    test_rows: int,
    train_positive_rows: int,
    test_positive_rows: int,
    class_imbalance_ratio: float | None,
) -> str:
    warnings = "\n".join(f"- {warning}" for warning in quality_warnings) or "- None"
    return f"""# Purchase Intent Model Evaluation

## Identity
- Site: `{metadata["site_id"]}`
- Use case: `{USE_CASE}`
- Model name: `{metadata["model_name"]}`
- Model run: `{model_run_id}`
- Model version: `{model_version}`
- Algorithm: `{algorithm}`
- Promoted: `{bool(promoted)}`

## Dataset
- DVC dataset: `{metadata["dataset_name"]}`
- Dataset hash: `{metadata["dataset_hash"]}`
- Rows: `{metadata["row_count"]}`
- Purchase rows: `{metadata["positive_count"]}`
- Window: `{metadata["window_start"]}` to `{metadata["window_end"]}`

## Validation
- Strategy: `{validation_strategy}`
- Sampling/imbalance strategy: `{sampling_strategy}`
- Train rows: `{train_rows}`
- Train purchases: `{train_positive_rows}`
- Test rows: `{test_rows}`
- Test purchases: `{test_positive_rows}`
- Class imbalance ratio: `{class_imbalance_ratio}`
- Decision threshold: `{clean_metric_value(metrics.get("decision_threshold"))}`

## Main Metrics
- ROC-AUC: `{clean_metric_value(metrics.get("auc"))}`
- Average precision: `{clean_metric_value(metrics.get("average_precision"))}`
- Rule baseline average precision: `{clean_metric_value(metrics.get("baseline_average_precision"))}`
- Brier score: `{clean_metric_value(metrics.get("brier"))}`
- Threshold precision: `{clean_metric_value(metrics.get("threshold_precision"))}`
- Threshold recall: `{clean_metric_value(metrics.get("threshold_recall"))}`
- Threshold F1: `{clean_metric_value(metrics.get("threshold_f1"))}`

## Business Ranking
- Precision@20: `{clean_metric_value(metrics.get("precision_top_20"))}`
- Recall@20: `{clean_metric_value(metrics.get("recall_top_20"))}`
- Lift@20: `{clean_metric_value(metrics.get("lift_top_20"))}`
- Precision@50: `{clean_metric_value(metrics.get("precision_top_50"))}`
- Recall@50: `{clean_metric_value(metrics.get("recall_top_50"))}`
- Lift@50: `{clean_metric_value(metrics.get("lift_top_50"))}`
- Precision@100: `{clean_metric_value(metrics.get("precision_top_100"))}`
- Recall@100: `{clean_metric_value(metrics.get("recall_top_100"))}`
- Lift@100: `{clean_metric_value(metrics.get("lift_top_100"))}`

## Quality Gate
{warnings}
"""


def distribution_psi(reference: np.ndarray, current: np.ndarray, bins: int = 10) -> float:
    reference = pd.to_numeric(pd.Series(reference), errors="coerce").dropna().to_numpy(dtype=float)
    current = pd.to_numeric(pd.Series(current), errors="coerce").dropna().to_numpy(dtype=float)
    if len(reference) == 0 or len(current) == 0:
        return 0.0
    if np.nanmin(reference) == np.nanmax(reference):
        edges = np.array([np.nanmin(reference) - 0.5, np.nanmax(reference) + 0.5])
    else:
        quantiles = np.linspace(0, 1, bins + 1)
        edges = np.unique(np.nanquantile(reference, quantiles))
        if len(edges) < 2:
            edges = np.array([np.nanmin(reference) - 0.5, np.nanmax(reference) + 0.5])
    ref_counts, _ = np.histogram(reference, bins=edges)
    cur_counts, _ = np.histogram(current, bins=edges)
    eps = 1e-6
    ref_pct = np.maximum(ref_counts / max(1, ref_counts.sum()), eps)
    cur_pct = np.maximum(cur_counts / max(1, cur_counts.sum()), eps)
    return float(np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct)))


def categorical_psi(reference: pd.Series, current: pd.Series) -> float:
    ref_counts = reference.fillna("__missing__").astype(str).value_counts(normalize=True)
    cur_counts = current.fillna("__missing__").astype(str).value_counts(normalize=True)
    categories = sorted(set(ref_counts.index).union(set(cur_counts.index)))
    eps = 1e-6
    score = 0.0
    for category in categories:
        ref_pct = max(float(ref_counts.get(category, 0.0)), eps)
        cur_pct = max(float(cur_counts.get(category, 0.0)), eps)
        score += (cur_pct - ref_pct) * math.log(cur_pct / ref_pct)
    return float(score)


def drift_band(score: float, config: PipelineConfig) -> str:
    if score >= config.drift_threshold:
        return "drift"
    if score >= config.drift_warning_threshold:
        return "warning"
    return "ok"


def compute_drift_report(reference_df: pd.DataFrame, current_df: pd.DataFrame, config: PipelineConfig) -> dict[str, Any]:
    numeric_rows = []
    categorical_rows = []
    for feature in NUMERIC_FEATURES:
        score = distribution_psi(reference_df.get(feature, pd.Series(dtype=float)), current_df.get(feature, pd.Series(dtype=float)))
        numeric_rows.append({"feature": feature, "psi": score, "status": drift_band(score, config)})
    for feature in CATEGORICAL_FEATURES:
        score = categorical_psi(reference_df.get(feature, pd.Series(dtype=str)), current_df.get(feature, pd.Series(dtype=str)))
        categorical_rows.append({"feature": feature, "psi": score, "status": drift_band(score, config)})

    reference_positive_rate = float(reference_df[TARGET_COLUMN].mean()) if TARGET_COLUMN in reference_df and len(reference_df) else 0.0
    current_positive_rate = float(current_df[TARGET_COLUMN].mean()) if TARGET_COLUMN in current_df and len(current_df) else 0.0
    label_shift = abs(current_positive_rate - reference_positive_rate)
    all_scores = [row["psi"] for row in numeric_rows + categorical_rows]
    drift_score = max(all_scores) if all_scores else 0.0
    warning_features = sum(1 for row in numeric_rows + categorical_rows if row["status"] == "warning")
    drifted_features = sum(1 for row in numeric_rows + categorical_rows if row["status"] == "drift")
    if len(current_df) < config.min_monitor_rows:
        status = "insufficient_current_data"
    elif drifted_features > 0:
        status = "drift_detected"
    elif warning_features > 0:
        status = "warning"
    else:
        status = "passed"
    return {
        "drift_status": status,
        "drift_score": drift_score,
        "warning_features": warning_features,
        "drifted_features": drifted_features,
        "numeric_drift": numeric_rows,
        "categorical_drift": categorical_rows,
        "label_drift": {
            "reference_positive_rate": reference_positive_rate,
            "current_positive_rate": current_positive_rate,
            "absolute_shift": label_shift,
        },
    }


def run_deepchecks_drift(reference_df: pd.DataFrame, current_df: pd.DataFrame) -> tuple[str, str]:
    try:
        patch_ipython_display_for_deepchecks()
        from deepchecks.tabular import Dataset
        from deepchecks.tabular.suites import train_test_validation

        columns = NUMERIC_FEATURES + CATEGORICAL_FEATURES + [TARGET_COLUMN]
        reference_sample = reference_df[columns].copy()
        current_sample = current_df[columns].copy()
        train_dataset = Dataset(reference_sample, label=TARGET_COLUMN, cat_features=CATEGORICAL_FEATURES)
        test_dataset = Dataset(current_sample, label=TARGET_COLUMN, cat_features=CATEGORICAL_FEATURES)
        result = train_test_validation().run(train_dataset, test_dataset)
        return "completed", str(result)[:8000]
    except Exception as exc:
        return "failed", f"{type(exc).__name__}: {exc}"


def write_monitoring_artifacts(site_id: str, report_id: str, report: dict[str, Any]) -> dict[str, str]:
    created = utc_now()
    report_dir = (
        DVC_WORKSPACE
        / "monitoring"
        / f"site={clean_name(site_id)}"
        / f"use_case={USE_CASE}"
        / f"date={created.strftime('%Y-%m-%d')}"
        / f"report={report_id}"
    )
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "monitoring_report.json"
    summary_path = report_dir / "monitoring_summary.md"
    numeric_path = report_dir / "numeric_drift.csv"
    categorical_path = report_dir / "categorical_drift.csv"
    report_path.write_text(json.dumps(report, indent=2, default=json_default), encoding="utf-8")
    pd.DataFrame(report.get("numeric_drift", [])).to_csv(numeric_path, index=False)
    pd.DataFrame(report.get("categorical_drift", [])).to_csv(categorical_path, index=False)
    summary_path.write_text(
        f"""# Purchase Intent Monitoring

- Site: `{site_id}`
- Status: `{report.get("drift_status")}`
- Drift score: `{report.get("drift_score")}`
- Warning features: `{report.get("warning_features")}`
- Drifted features: `{report.get("drifted_features")}`
- Action taken: `{report.get("action_taken", "pending")}`
- Reference model run: `{report.get("reference_model_run_id", "")}`
- Reference snapshot: `{report.get("reference_snapshot_id", "")}`

## Label Shift

```json
{json.dumps(report.get("label_drift", {}), indent=2, default=json_default)}
```
""",
        encoding="utf-8",
    )
    return {
        "report_dir": str(report_dir),
        "report_uri": str(report_path),
        "summary_uri": str(summary_path),
        "numeric_uri": str(numeric_path),
        "categorical_uri": str(categorical_path),
    }


def log_monitoring_to_mlflow(report: dict[str, Any], artifacts: dict[str, str]) -> str:
    mlflow_run_id = ""
    try:
        mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000"))
        mlflow.set_experiment("BehaviourAI - Purchase Intent Monitoring")
        run_name = f"{report['site_id']} | drift monitor | {utc_now().strftime('%Y-%m-%d %H:%M UTC')}"
        with mlflow.start_run(run_name=run_name) as run:
            mlflow_run_id = run.info.run_id
            mlflow.set_tags(
                {
                    "site_id": report["site_id"],
                    "model_use_case": USE_CASE,
                    "drift_status": report["drift_status"],
                    "action_taken": report.get("action_taken", ""),
                    "reference_model_run_id": report.get("reference_model_run_id", ""),
                    "reference_snapshot_id": report.get("reference_snapshot_id", ""),
                }
            )
            mlflow.log_params(
                {
                    "current_rows": report.get("current_rows", 0),
                    "reference_rows": report.get("reference_rows", 0),
                    "current_positive_rows": report.get("current_positive_rows", 0),
                    "reference_positive_rows": report.get("reference_positive_rows", 0),
                    "drifted_features": report.get("drifted_features", 0),
                    "warning_features": report.get("warning_features", 0),
                }
            )
            mlflow.log_metric("drift_score", float(report.get("drift_score", 0.0)))
            mlflow.log_metric("drifted_features", float(report.get("drifted_features", 0)))
            mlflow.log_metric("warning_features", float(report.get("warning_features", 0)))
            mlflow.log_metric("current_rows", float(report.get("current_rows", 0)))
            mlflow.log_metric("reference_rows", float(report.get("reference_rows", 0)))
            mlflow.log_artifacts(artifacts["report_dir"], artifact_path="monitoring")
    except Exception:
        return mlflow_run_id
    return mlflow_run_id


def normalize_rule_score(value: Any) -> float:
    score = float(value or 0)
    if score > 1:
        score = score / 100.0
    return max(0.0, min(1.0, score))


def row_float(row: pd.Series, key: str) -> float:
    try:
        value = float(row.get(key, 0) or 0)
    except (TypeError, ValueError):
        value = 0.0
    return value


def safe_rule_baseline_score(row: pd.Series) -> float:
    """Pre-purchase behavioural rule score without using purchase outcome fields."""
    product_view_count = row_float(row, "product_view_count")
    product_impression_count = row_float(row, "product_impression_count")
    unique_products_viewed = row_float(row, "unique_products_viewed")
    add_to_cart_count = row_float(row, "add_to_cart_count")
    cart_view_count = row_float(row, "cart_view_count")
    checkout_start_count = row_float(row, "checkout_start_count")
    shipping_selection_count = row_float(row, "shipping_selection_count")
    payment_selection_count = row_float(row, "payment_selection_count")
    search_event_count = row_float(row, "search_event_count")
    click_count = row_float(row, "click_count")
    scroll_event_count = row_float(row, "scroll_event_count")
    duration_sec = row_float(row, "duration_sec")
    event_count = row_float(row, "event_count")
    cart_value_max = row_float(row, "cart_value_max")
    login_count = row_float(row, "login_count")
    registration_count = row_float(row, "registration_count")
    is_new_visitor = row_float(row, "is_new_visitor")
    remove_from_cart_count = row_float(row, "remove_from_cart_count")
    payment_failed_count = row_float(row, "payment_failed_count")
    zero_result_search_count = row_float(row, "zero_result_search_count")
    page_view_count = row_float(row, "page_view_count")

    score = (
        6
        + min(product_view_count, 6) * 5
        + min(product_impression_count, 10) * 0.8
        + min(unique_products_viewed, 5) * 4
        + min(add_to_cart_count + cart_view_count, 4) * 14
        + min(checkout_start_count, 1) * 18
        + min(shipping_selection_count + payment_selection_count, 2) * 7
        + min(search_event_count, 3) * 4
        + min(click_count, 12) * 0.8
        + min(scroll_event_count, 6) * 1.5
        + min(duration_sec, 420) / 420 * 10
        + min(event_count, 40) / 40 * 8
        + (min(math.log(1 + cart_value_max), 6) * 2.5 if cart_value_max > 0 else 0)
        + (6 if login_count > 0 or registration_count > 0 else 0)
        + (3 if is_new_visitor == 0 else 0)
        - (7 if remove_from_cart_count > 0 else 0)
        - (10 if payment_failed_count > 0 else 0)
        - (5 if zero_result_search_count > 0 else 0)
        - (18 if page_view_count <= 1 and duration_sec <= 15 else 0)
    )
    return max(0.0, min(1.0, score / 100.0))


def train_model(df: pd.DataFrame, metadata: dict[str, Any], report: dict[str, Any], config: PipelineConfig) -> dict[str, Any]:
    now = utc_now()
    model_run_id = f"{metadata['site_slug']}__{USE_CASE}__run__{now.strftime('%Y%m%dT%H%M%SZ')}__{uuid.uuid4().hex[:8]}"
    model_name = metadata["model_name"]
    if report["status"] != "passed":
        return {
            "model_run_id": model_run_id,
            "snapshot_id": metadata["snapshot_id"],
            "site_id": metadata["site_id"],
            "model_name": model_name,
            "model_version": model_run_id,
            "algorithm": "none",
            "status": "validation_failed",
            "promoted": 0,
            "message": "; ".join(report["critical"]),
            "created_at": format_dt(now),
            "updated_at": format_dt(now),
            "pipeline": None,
            "model_uri": "",
            "mlflow_run_id": "",
            "mlflow_experiment_id": "",
            "metrics": {},
            "train_rows": 0,
            "test_rows": 0,
        }

    df_model = df.sort_values("session_start", kind="mergesort").reset_index(drop=True)
    X = df_model[NUMERIC_FEATURES + CATEGORICAL_FEATURES].copy()
    y = df_model[TARGET_COLUMN].astype(int).to_numpy()
    row_count = len(df)
    positive_count = int(y.sum())
    train_idx, test_idx, validation_strategy = chronological_train_test_split(df_model, y, config)
    rule_scores = df_model.apply(safe_rule_baseline_score, axis=1).to_numpy()

    X_train = X.iloc[train_idx]
    X_test = X.iloc[test_idx]
    y_train = y[train_idx]
    y_test = y[test_idx]
    rule_train = rule_scores[train_idx]
    rule_test = rule_scores[test_idx]

    train_positive_count = int(y_train.sum())
    train_negative_count = int(len(y_train) - train_positive_count)
    test_positive_count = int(y_test.sum())
    class_imbalance_ratio = float(train_negative_count / train_positive_count) if train_positive_count else None
    algorithm, model = build_model(len(X_train), train_positive_count, class_imbalance_ratio or 1.0)
    pipeline = make_pipeline(algorithm, model)
    sampling_strategy = "full_data_weighted_by_class"

    pipeline.fit(X_train, y_train)
    probabilities = predict_probability(pipeline, X_test)
    baseline_ap = None
    if len(np.unique(y_test)) >= 2:
        baseline_ap = float(average_precision_score(y_test, rule_test))
    selected_threshold, selected_threshold_metrics = select_decision_threshold(y_test, probabilities, config.action_threshold)
    metrics: dict[str, float | int | None] = {
        "auc": None,
        "average_precision": None,
        "baseline_average_precision": baseline_ap,
        "brier": float(brier_score_loss(y_test, probabilities)) if len(y_test) else None,
        "decision_threshold": selected_threshold,
        "threshold_precision": selected_threshold_metrics["precision"],
        "threshold_recall": selected_threshold_metrics["recall"],
        "threshold_f1": selected_threshold_metrics["f1"],
        "threshold_tp": selected_threshold_metrics["tp"],
        "threshold_fp": selected_threshold_metrics["fp"],
        "threshold_fn": selected_threshold_metrics["fn"],
        "threshold_tn": selected_threshold_metrics["tn"],
    }
    metrics.update(ranking_metric_bundle(np.asarray(y_test), probabilities))
    metrics.update(ranking_metric_bundle(np.asarray(y_test), np.asarray(rule_test), prefix="baseline_"))
    if len(np.unique(y_test)) == 2:
        metrics["auc"] = float(roc_auc_score(y_test, probabilities))
        metrics["average_precision"] = float(average_precision_score(y_test, probabilities))

    model_dir = Path(metadata["dataset_uri"]).parent / "model"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "model.joblib"
    joblib.dump(pipeline, model_path)

    average_precision = metrics.get("average_precision")
    baseline_average_precision = metrics.get("baseline_average_precision")
    precision_top_50 = metrics.get("precision_top_50")
    baseline_precision_top_50 = metrics.get("baseline_precision_top_50")
    quality_warnings: list[str] = []
    if test_positive_count < MIN_PROMOTION_TEST_POSITIVES:
        quality_warnings.append(
            f"Only {test_positive_count} purchase sessions in validation; at least {MIN_PROMOTION_TEST_POSITIVES} are required for promotion."
        )
    if validation_strategy != "chronological_holdout":
        quality_warnings.append(f"Validation used {validation_strategy}; chronological holdout is required for promotion.")

    promoted = int(
        report["status"] == "passed"
        and not quality_warnings
        and (metrics["auc"] is None or float(metrics["auc"]) >= 0.5)
        and (
            baseline_average_precision is None
            or average_precision is None
            or float(average_precision) >= float(baseline_average_precision)
        )
        and (
            baseline_precision_top_50 is None
            or precision_top_50 is None
            or float(precision_top_50) >= float(baseline_precision_top_50)
        )
    )

    artifact_dir = Path(metadata["dataset_uri"]).parent / "mlflow_artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    validation_predictions = validation_predictions_frame(df_model, test_idx, y_test, probabilities, rule_test, selected_threshold)
    feature_importance = feature_importance_frame(pipeline, algorithm)
    top_k_report = top_k_report_frame(metrics)
    (artifact_dir / "feature_schema.json").write_text(
        json.dumps(feature_schema_payload(metadata), indent=2, default=json_default),
        encoding="utf-8",
    )
    (artifact_dir / "metrics.json").write_text(
        json.dumps(serializable_metrics(metrics), indent=2, default=json_default),
        encoding="utf-8",
    )
    (artifact_dir / "quality_gate.json").write_text(
        json.dumps(
            {
                "promoted": bool(promoted),
                "quality_gate": "passed" if promoted else "blocked",
                "warnings": quality_warnings,
                "min_promotion_test_positives": MIN_PROMOTION_TEST_POSITIVES,
                "validation_strategy": validation_strategy,
                "test_positive_rows": test_positive_count,
            },
            indent=2,
            default=json_default,
        ),
        encoding="utf-8",
    )
    top_k_report.to_csv(artifact_dir / "top_k_business_report.csv", index=False)
    feature_importance.to_csv(artifact_dir / "feature_importance.csv", index=False)
    validation_predictions.head(500).to_csv(artifact_dir / "validation_predictions_top500.csv", index=False)

    mlflow_run_id = ""
    mlflow_experiment_id = ""
    model_version = model_run_id
    model_uri = str(model_path)
    message = ""
    try:
        mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000"))
        mlflow.set_experiment(MLFLOW_EXPERIMENT_NAME)
        run_name = f"{metadata['site_id']} | purchase intent | {now.strftime('%Y-%m-%d %H:%M UTC')}"
        with mlflow.start_run(run_name=run_name) as run:
            mlflow_run_id = run.info.run_id
            mlflow_experiment_id = run.info.experiment_id
            mlflow.set_tags(
                {
                    "site_id": metadata["site_id"],
                    "site_slug": metadata["site_slug"],
                    "model_name": model_name,
                    "model_use_case": USE_CASE,
                    "snapshot_id": metadata["snapshot_id"],
                    "dataset_name": metadata["dataset_name"],
                    "dataset_hash": metadata["dataset_hash"],
                    "dvc_status": metadata["dvc_status"],
                    "rule_version": RULE_VERSION,
                    "training_mode": "site_specific_batch",
                    "validation_strategy": validation_strategy,
                    "sampling_strategy": sampling_strategy,
                    "quality_gate": "passed" if promoted else "blocked",
                    "promoted": str(bool(promoted)).lower(),
                    "test_positive_rows": str(test_positive_count),
                }
            )
            mlflow.log_params(
                {
                    "site_id": metadata["site_id"],
                    "snapshot_id": metadata["snapshot_id"],
                    "algorithm": algorithm,
                    "use_case": USE_CASE,
                    "model_name": model_name,
                    "feature_count": metadata["feature_count"],
                    "rule_version": RULE_VERSION,
                    "window_start": metadata["window_start"],
                    "window_end": metadata["window_end"],
                    "validation_strategy": validation_strategy,
                    "sampling_strategy": sampling_strategy,
                    "class_imbalance_ratio": class_imbalance_ratio,
                    "decision_threshold": selected_threshold,
                    "train_positive_rows": train_positive_count,
                    "test_positive_rows": test_positive_count,
                    "min_promotion_test_positives": MIN_PROMOTION_TEST_POSITIVES,
                }
            )
            for key, value in metrics.items():
                if isinstance(value, (int, float)) and value is not None and np.isfinite(value):
                    mlflow.log_metric(key, float(value))
            mlflow.log_artifact(metadata["dataset_uri"])
            mlflow.log_artifact(str(Path(metadata["dataset_uri"]).parent / "metadata.json"))
            mlflow.log_artifact(report["report_uri"])
            input_example = X_train.head(min(5, len(X_train))).copy()
            for column in NUMERIC_FEATURES:
                if column in input_example:
                    input_example[column] = pd.to_numeric(input_example[column], errors="coerce").astype(float)
            for column in CATEGORICAL_FEATURES:
                if column in input_example:
                    input_example[column] = input_example[column].fillna("").astype(str)
            signature = infer_signature(input_example, predict_probability(pipeline, input_example))
            logged_model = mlflow.sklearn.log_model(
                pipeline,
                artifact_path="model",
                signature=signature,
                input_example=input_example,
            )
            model_uri = getattr(logged_model, "model_uri", f"runs:/{mlflow_run_id}/model")
            try:
                registration = mlflow.register_model(model_uri, model_name)
                model_version = str(registration.version)
                model_uri = f"models:/{model_name}/{model_version}"
                client = MlflowClient()
                client.set_model_version_tag(model_name, model_version, "site_id", metadata["site_id"])
                client.set_model_version_tag(model_name, model_version, "model_use_case", USE_CASE)
                client.set_model_version_tag(model_name, model_version, "quality_gate", "passed" if promoted else "blocked")
                client.set_model_version_tag(model_name, model_version, "promoted", str(bool(promoted)).lower())
                client.set_model_version_tag(model_name, model_version, "validation_strategy", validation_strategy)
                client.set_model_version_tag(model_name, model_version, "test_positive_rows", str(test_positive_count))
                client.set_model_version_tag(model_name, model_version, "dataset_hash", metadata["dataset_hash"])
                client.set_registered_model_alias(model_name, "production" if promoted else "candidate", model_version)
                if promoted:
                    client.set_registered_model_alias(model_name, "champion", model_version)
            except Exception as registry_exc:
                message = f"Model logged to MLflow, but registry promotion failed: {type(registry_exc).__name__}: {registry_exc}"
            (artifact_dir / "evaluation_report.md").write_text(
                build_evaluation_report(
                    metadata=metadata,
                    model_run_id=model_run_id,
                    algorithm=algorithm,
                    model_version=model_version,
                    metrics=metrics,
                    validation_strategy=validation_strategy,
                    sampling_strategy=sampling_strategy,
                    promoted=promoted,
                    quality_warnings=quality_warnings,
                    train_rows=int(len(X_train)),
                    test_rows=int(len(X_test)),
                    train_positive_rows=train_positive_count,
                    test_positive_rows=test_positive_count,
                    class_imbalance_ratio=class_imbalance_ratio,
                ),
                encoding="utf-8",
            )
            mlflow.log_artifacts(str(artifact_dir), artifact_path="evaluation")
    except Exception as exc:
        message = f"MLflow logging failed, local model saved: {type(exc).__name__}: {exc}"

    if quality_warnings:
        message = "; ".join([part for part in [message, *quality_warnings] if part])
    return {
        "model_run_id": model_run_id,
        "snapshot_id": metadata["snapshot_id"],
        "site_id": metadata["site_id"],
        "model_name": model_name,
        "model_version": model_version,
        "algorithm": algorithm,
        "status": "trained",
        "promoted": promoted,
        "message": message,
        "created_at": format_dt(now),
        "updated_at": format_dt(utc_now()),
        "pipeline": pipeline,
        "model_uri": model_uri,
        "local_model_path": str(model_path),
        "mlflow_run_id": mlflow_run_id,
        "mlflow_experiment_id": mlflow_experiment_id,
        "metrics": metrics,
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "train_positive_rows": train_positive_count,
        "test_positive_rows": test_positive_count,
        "class_imbalance_ratio": class_imbalance_ratio,
        "validation_strategy": validation_strategy,
        "sampling_strategy": sampling_strategy,
        "decision_threshold": selected_threshold,
    }


def insert_model_run(client: ClickHouseHttpClient, model_run: dict[str, Any], metadata: dict[str, Any]) -> None:
    metrics = model_run.get("metrics") or {}
    client.insert_json_each_row(
        "ml_model_runs",
        [
            {
                "model_run_id": model_run["model_run_id"],
                "snapshot_id": metadata["snapshot_id"],
                "site_id": metadata["site_id"],
                "model_use_case": USE_CASE,
                "model_name": model_run.get("model_name", metadata.get("model_name", MODEL_NAME)),
                "model_version": model_run.get("model_version", model_run["model_run_id"]),
                "algorithm": model_run["algorithm"],
                "mlflow_run_id": model_run.get("mlflow_run_id", ""),
                "mlflow_experiment_id": model_run.get("mlflow_experiment_id", ""),
                "model_uri": model_run.get("model_uri", ""),
                "status": model_run["status"],
                "promoted": model_run["promoted"],
                "metric_auc": metrics.get("auc"),
                "metric_average_precision": metrics.get("average_precision"),
                "metric_baseline_average_precision": metrics.get("baseline_average_precision"),
                "metric_precision_top_10_pct": metrics.get("precision_top_10_pct"),
                "metric_baseline_precision_top_10_pct": metrics.get("baseline_precision_top_10_pct"),
                "metric_recall_top_10_pct": metrics.get("recall_top_10_pct"),
                "metric_baseline_recall_top_10_pct": metrics.get("baseline_recall_top_10_pct"),
                "metric_lift_top_10_pct": metrics.get("lift_top_10_pct"),
                "metric_baseline_lift_top_10_pct": metrics.get("baseline_lift_top_10_pct"),
                "metric_precision_top_20": metrics.get("precision_top_20"),
                "metric_recall_top_20": metrics.get("recall_top_20"),
                "metric_lift_top_20": metrics.get("lift_top_20"),
                "metric_baseline_precision_top_20": metrics.get("baseline_precision_top_20"),
                "metric_baseline_recall_top_20": metrics.get("baseline_recall_top_20"),
                "metric_baseline_lift_top_20": metrics.get("baseline_lift_top_20"),
                "metric_precision_top_50": metrics.get("precision_top_50"),
                "metric_recall_top_50": metrics.get("recall_top_50"),
                "metric_lift_top_50": metrics.get("lift_top_50"),
                "metric_baseline_precision_top_50": metrics.get("baseline_precision_top_50"),
                "metric_baseline_recall_top_50": metrics.get("baseline_recall_top_50"),
                "metric_baseline_lift_top_50": metrics.get("baseline_lift_top_50"),
                "metric_precision_top_100": metrics.get("precision_top_100"),
                "metric_recall_top_100": metrics.get("recall_top_100"),
                "metric_lift_top_100": metrics.get("lift_top_100"),
                "metric_baseline_precision_top_100": metrics.get("baseline_precision_top_100"),
                "metric_baseline_recall_top_100": metrics.get("baseline_recall_top_100"),
                "metric_baseline_lift_top_100": metrics.get("baseline_lift_top_100"),
                "metric_brier": metrics.get("brier"),
                "metric_threshold_precision": metrics.get("threshold_precision"),
                "metric_threshold_recall": metrics.get("threshold_recall"),
                "metric_threshold_f1": metrics.get("threshold_f1"),
                "decision_threshold": model_run.get("decision_threshold"),
                "class_imbalance_ratio": model_run.get("class_imbalance_ratio"),
                "validation_strategy": model_run.get("validation_strategy", ""),
                "sampling_strategy": model_run.get("sampling_strategy", ""),
                "train_rows": model_run.get("train_rows", 0),
                "test_rows": model_run.get("test_rows", 0),
                "train_positive_rows": model_run.get("train_positive_rows", 0),
                "test_positive_rows": model_run.get("test_positive_rows", 0),
                "feature_count": metadata["feature_count"],
                "metrics_json": json.dumps(metrics, default=json_default, separators=(",", ":")),
                "message": model_run.get("message", ""),
                "created_at": model_run["created_at"],
                "updated_at": model_run["updated_at"],
            }
        ],
    )


def predict_probability(pipeline: Pipeline, X: pd.DataFrame) -> np.ndarray:
    if hasattr(pipeline, "predict_proba"):
        probabilities = pipeline.predict_proba(X)
        if probabilities.shape[1] == 1:
            constant = float(getattr(pipeline.named_steps["model"], "classes_", [0])[0])
            return np.full(len(X), constant)
        return probabilities[:, 1]
    decision = pipeline.decision_function(X)
    return 1.0 / (1.0 + np.exp(-decision))


def intent_tier(probability: float) -> str:
    if probability >= 0.75:
        return "hot"
    if probability >= 0.45:
        return "warm"
    if probability >= 0.2:
        return "interested"
    return "cold"


def choose_action(row: pd.Series, probability: float, rule_score: float, threshold: float) -> tuple[str, str, str]:
    has_purchase = int(row.get("has_purchase", 0) or 0) > 0 or int(row.get("purchase_count", 0) or 0) > 0
    has_cart = int(row.get("has_add_to_cart", 0) or 0) > 0 or int(row.get("add_to_cart_count", 0) or 0) > 0
    has_checkout = int(row.get("has_checkout_start", 0) or 0) > 0 or int(row.get("checkout_start_count", 0) or 0) > 0
    has_product_view = int(row.get("has_product_view", 0) or 0) > 0 or int(row.get("product_view_count", 0) or 0) > 0

    if has_purchase:
        return "none", "low", "Session already purchased; no recovery action needed."
    if has_checkout and probability >= threshold:
        return "checkout_recovery", "high" if probability >= 0.65 else "medium", "Checkout started but no purchase; ML score suggests recovery is worthwhile."
    if has_cart and probability >= threshold:
        return "abandoned_cart_recovery", "high" if probability >= 0.65 else "medium", "Cart activity without purchase; ML and rules agree this visitor is recoverable."
    if has_product_view and probability >= max(0.45, threshold):
        return "product_recommendation", "medium", "Product interest is visible but no cart was created; recommend a relevant product."
    if rule_score >= 0.6 and probability >= 0.2:
        return "dashboard_alert", "low", "Rules show intent, but ML confidence is not high enough for direct outreach."
    return "monitor", "low", "No action: confidence or business conditions are too weak."


def score_and_decide(client: ClickHouseHttpClient, df: pd.DataFrame, model_run: dict[str, Any], metadata: dict[str, Any], config: PipelineConfig) -> dict[str, int]:
    pipeline = model_run.get("pipeline")
    if pipeline is None:
        return {"predictions": 0, "actions": 0, "audits": 0}

    scored_at = utc_now()
    X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES].copy()
    probabilities = predict_probability(pipeline, X)
    action_threshold = float(model_run.get("decision_threshold") or config.action_threshold)
    prediction_rows: list[dict[str, Any]] = []
    action_rows: list[dict[str, Any]] = []
    audit_rows: list[dict[str, Any]] = []

    for index, (_, row) in enumerate(df.iterrows()):
        probability = float(max(0.0, min(1.0, probabilities[index])))
        rule_score = safe_rule_baseline_score(row)
        action_type, priority, reason = choose_action(row, probability, rule_score, action_threshold)
        model_is_promoted = bool(model_run.get("promoted"))
        is_recoverable = model_is_promoted and action_type in {"abandoned_cart_recovery", "checkout_recovery", "product_recommendation", "dashboard_alert"}
        abandonment_risk = probability if action_type in {"abandoned_cart_recovery", "checkout_recovery"} else 0.0
        prediction_id = f"pred_{metadata['site_id']}_{row['session_id']}_{model_run['model_run_id']}"
        features_json = json.dumps(
            {feature: row.get(feature, None) for feature in NUMERIC_FEATURES + CATEGORICAL_FEATURES},
            default=json_default,
            separators=(",", ":"),
        )
        prediction_rows.append(
            {
                "prediction_id": prediction_id,
                "site_id": row["site_id"],
                "platform": row.get("platform", ""),
                "session_id": row["session_id"],
                "visitor_id": row.get("visitor_id", ""),
                "customer_id": row.get("customer_id", ""),
                "customer_email": row.get("customer_email", ""),
                "model_run_id": model_run["model_run_id"],
                "snapshot_id": metadata["snapshot_id"],
                "model_name": model_run.get("model_name", metadata.get("model_name", MODEL_NAME)),
                "model_version": model_run.get("model_version", model_run["model_run_id"]),
                "scored_at": format_dt(scored_at),
                "window_start": metadata["window_start"],
                "window_end": metadata["window_end"],
                "purchase_probability": probability,
                "abandonment_risk": abandonment_risk,
                "rule_baseline_score": rule_score,
                "intent_tier": intent_tier(probability),
                "recommended_action": action_type,
                "reason": reason,
                "features_json": features_json,
                "updated_at": format_dt(scored_at),
            }
        )

        audit_rows.append(
            {
                "decision_id": f"dec_{uuid.uuid4().hex}",
                "site_id": row["site_id"],
                "session_id": row["session_id"],
                "visitor_id": row.get("visitor_id", ""),
                "model_run_id": model_run["model_run_id"],
                "prediction_id": prediction_id,
                "action_type": action_type,
                "accepted": int(is_recoverable),
                "rule_version": RULE_VERSION,
                "reason": reason,
                "context_json": json.dumps({"probability": probability, "rule_score": rule_score, "priority": priority}, separators=(",", ":")),
                "decided_at": format_dt(scored_at),
            }
        )

        if is_recoverable:
            channel = "email" if str(row.get("customer_email", "")).strip() else "dashboard_alert"
            action_rows.append(
                {
                    "action_id": f"act_{metadata['site_id']}_{row['session_id']}_{action_type}_{model_run['model_run_id']}",
                    "site_id": row["site_id"],
                    "platform": row.get("platform", ""),
                    "session_id": row["session_id"],
                    "visitor_id": row.get("visitor_id", ""),
                    "customer_id": row.get("customer_id", ""),
                    "customer_email": row.get("customer_email", ""),
                    "action_type": action_type,
                    "channel": channel,
                    "priority": priority,
                    "status": "prepared",
                    "source": "hybrid_ml_rules",
                    "model_run_id": model_run["model_run_id"],
                    "snapshot_id": metadata["snapshot_id"],
                    "prediction_id": prediction_id,
                    "prediction_score": probability,
                    "rule_score": rule_score,
                    "title": action_title(action_type),
                    "reason": reason,
                    "payload_json": json.dumps(
                        {
                            "session_id": row["session_id"],
                            "visitor_id": row.get("visitor_id", ""),
                            "purchase_probability": probability,
                            "rule_score": rule_score,
                            "layer2_purchase_intent_score": normalize_rule_score(row.get("purchase_intent_score", 0)),
                            "channel": channel,
                            "send_mode": "draft_only",
                        },
                        separators=(",", ":"),
                    ),
                    "generated_at": format_dt(scored_at),
                    "expires_at": format_dt(scored_at + timedelta(days=7)),
                    "updated_at": format_dt(scored_at),
                }
            )

    action_rows = sorted(action_rows, key=lambda item: (item["prediction_score"], item["rule_score"]), reverse=True)[: config.max_actions]

    return {
        "predictions": client.insert_json_each_row("ml_purchase_intent_predictions", prediction_rows),
        "actions": client.insert_json_each_row("smart_action_candidates", action_rows),
        "audits": client.insert_json_each_row("ml_rule_decision_audit", audit_rows),
    }


def action_title(action_type: str) -> str:
    return {
        "abandoned_cart_recovery": "Prepare abandoned cart recovery",
        "checkout_recovery": "Prepare checkout recovery",
        "product_recommendation": "Prepare product recommendation",
        "dashboard_alert": "Review high-intent visitor",
    }.get(action_type, "Review smart action")


def run_for_site(client: ClickHouseHttpClient, site_id: str, config: PipelineConfig) -> dict[str, Any]:
    ensure_schema(client)
    window_end = utc_now()
    window_start = window_end - timedelta(days=config.lookback_days)
    df = load_sessions(client, site_id, window_start, window_end)
    metadata = export_snapshot(df, site_id, window_start, window_end)
    report = validate_snapshot(df, metadata, config)
    insert_snapshot_and_report(client, metadata, report)
    model_run = train_model(df, metadata, report, config)
    insert_model_run(client, model_run, metadata)
    counts = score_and_decide(client, df, model_run, metadata, config)
    return {
        "site_id": site_id,
        "snapshot_id": metadata["snapshot_id"],
        "model_run_id": model_run["model_run_id"],
        "validation_status": report["status"],
        "model_status": model_run["status"],
        "algorithm": model_run["algorithm"],
        "rows": metadata["row_count"],
        "positive_rows": metadata["positive_count"],
        **counts,
    }


def insert_monitoring_report(client: ClickHouseHttpClient, report: dict[str, Any]) -> None:
    client.insert_json_each_row(
        "ml_monitoring_reports",
        [
            {
                "report_id": report["report_id"],
                "site_id": report["site_id"],
                "model_use_case": USE_CASE,
                "reference_model_run_id": report.get("reference_model_run_id", ""),
                "reference_snapshot_id": report.get("reference_snapshot_id", ""),
                "reference_dataset_uri": report.get("reference_dataset_uri", ""),
                "current_window_start": report["current_window_start"],
                "current_window_end": report["current_window_end"],
                "reference_rows": report.get("reference_rows", 0),
                "current_rows": report.get("current_rows", 0),
                "reference_positive_rows": report.get("reference_positive_rows", 0),
                "current_positive_rows": report.get("current_positive_rows", 0),
                "drift_status": report.get("drift_status", "unknown"),
                "drift_score": report.get("drift_score", 0.0),
                "warning_features": report.get("warning_features", 0),
                "drifted_features": report.get("drifted_features", 0),
                "deepchecks_status": report.get("deepchecks_status", "not_run"),
                "deepchecks_report_uri": report.get("deepchecks_report_uri", ""),
                "monitoring_report_uri": report.get("monitoring_report_uri", ""),
                "mlflow_run_id": report.get("mlflow_run_id", ""),
                "action_taken": report.get("action_taken", "none"),
                "retrain_model_run_id": report.get("retrain_model_run_id", ""),
                "report_json": json.dumps(report, default=json_default, separators=(",", ":")),
                "created_at": report["created_at"],
            }
        ],
    )


def monitor_site(client: ClickHouseHttpClient, site_id: str, config: PipelineConfig) -> dict[str, Any]:
    ensure_schema(client)
    current_end = utc_now()
    current_start = current_end - timedelta(days=config.monitor_lookback_days)
    current_df = load_sessions(client, site_id, current_start, current_end)
    report_id = f"{clean_name(site_id)}__{USE_CASE}__monitor__{current_end.strftime('%Y%m%dT%H%M%SZ')}__{uuid.uuid4().hex[:8]}"
    reference_run = latest_reference_run(client, site_id)
    report: dict[str, Any] = {
        "report_id": report_id,
        "site_id": site_id,
        "model_use_case": USE_CASE,
        "current_window_start": format_dt(current_start),
        "current_window_end": format_dt(current_end),
        "current_rows": int(len(current_df)),
        "current_positive_rows": int(current_df[TARGET_COLUMN].sum()) if TARGET_COLUMN in current_df and len(current_df) else 0,
        "reference_rows": 0,
        "reference_positive_rows": 0,
        "reference_model_run_id": "",
        "reference_snapshot_id": "",
        "reference_dataset_uri": "",
        "drift_status": "unknown",
        "drift_score": 0.0,
        "warning_features": 0,
        "drifted_features": 0,
        "deepchecks_status": "not_run",
        "deepchecks_message": "",
        "action_taken": "none",
        "retrain_model_run_id": "",
        "created_at": format_dt(current_end),
    }

    reference_df: pd.DataFrame | None = None
    if not reference_run:
        report["drift_status"] = "no_reference_model"
        report["action_taken"] = "retrain_no_reference_model"
    else:
        report["reference_model_run_id"] = str(reference_run.get("model_run_id", ""))
        report["reference_snapshot_id"] = str(reference_run.get("snapshot_id", ""))
        snapshot = snapshot_metadata(client, report["reference_snapshot_id"])
        dataset_uri = str(snapshot.get("dataset_uri", "")) if snapshot else ""
        report["reference_dataset_uri"] = dataset_uri
        dataset_path = Path(dataset_uri)
        if not snapshot or not dataset_uri or not dataset_path.exists():
            report["drift_status"] = "reference_dataset_missing"
            report["action_taken"] = "retrain_reference_dataset_missing"
        else:
            reference_df = pd.read_parquet(dataset_path)
            report["reference_rows"] = int(len(reference_df))
            report["reference_positive_rows"] = int(reference_df[TARGET_COLUMN].sum()) if TARGET_COLUMN in reference_df and len(reference_df) else 0
            drift = compute_drift_report(reference_df, current_df, config)
            report.update(drift)
            deepchecks_status, deepchecks_message = run_deepchecks_drift(reference_df, current_df)
            report["deepchecks_status"] = deepchecks_status
            report["deepchecks_message"] = deepchecks_message
            if config.force_retrain:
                report["action_taken"] = "retrain_forced"
            elif report["drift_status"] == "drift_detected" and config.retrain_on_drift:
                report["action_taken"] = "retrain_drift_detected"
            elif report["drift_status"] == "insufficient_current_data":
                report["action_taken"] = "no_retrain_insufficient_current_data"
            elif report["drift_status"] == "warning":
                report["action_taken"] = "no_retrain_warning_only"
            else:
                report["action_taken"] = "no_retrain_drift_gate_passed"

    should_retrain = str(report["action_taken"]).startswith("retrain_")
    if should_retrain:
        retrain_config = replace(
            config,
            site_id=site_id,
            lookback_days=max(config.lookback_days, config.retrain_lookback_days),
        )
        retrain_result = run_for_site(client, site_id, retrain_config)
        report["retrain_result"] = retrain_result
        report["retrain_model_run_id"] = retrain_result.get("model_run_id", "")

    artifacts = write_monitoring_artifacts(site_id, report_id, report)
    report["monitoring_report_uri"] = artifacts["report_uri"]
    report["deepchecks_report_uri"] = artifacts["report_uri"]
    report["mlflow_run_id"] = log_monitoring_to_mlflow(report, artifacts)
    insert_monitoring_report(client, report)

    return {
        "site_id": site_id,
        "report_id": report_id,
        "drift_status": report["drift_status"],
        "drift_score": report["drift_score"],
        "warning_features": report["warning_features"],
        "drifted_features": report["drifted_features"],
        "action_taken": report["action_taken"],
        "retrain_model_run_id": report.get("retrain_model_run_id", ""),
        "current_rows": report["current_rows"],
        "reference_rows": report.get("reference_rows", 0),
        "mlflow_run_id": report.get("mlflow_run_id", ""),
    }


def run_monitoring_pipeline(config: PipelineConfig) -> dict[str, Any]:
    client = ClickHouseHttpClient.from_env()
    ensure_schema(client)
    sites = [config.site_id] if config.site_id else list_sites(client, max(config.lookback_days, config.monitor_lookback_days))
    results = []
    for site_id in sites:
        if site_id:
            results.append(monitor_site(client, site_id, config))
    return {
        "status": "completed",
        "mode": "monitor_and_retrain_on_drift",
        "use_case": USE_CASE,
        "site_count": len(results),
        "results": results,
        "finished_at": format_dt(utc_now()),
    }


def run_pipeline(config: PipelineConfig) -> dict[str, Any]:
    client = ClickHouseHttpClient.from_env()
    ensure_schema(client)
    sites = [config.site_id] if config.site_id else list_sites(client, config.lookback_days)
    results = []
    for site_id in sites:
        if site_id:
            results.append(run_for_site(client, site_id, config))
    return {
        "status": "completed",
        "use_case": USE_CASE,
        "site_count": len(results),
        "results": results,
        "finished_at": format_dt(utc_now()),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train, score, and decide purchase-intent smart actions.")
    parser.add_argument("--mode", choices=["train", "monitor"], default=os.getenv("ML_PIPELINE_MODE", "train"))
    parser.add_argument("--site-id", default=None)
    parser.add_argument("--lookback-days", type=int, default=int(os.getenv("ML_LOOKBACK_DAYS", "30")))
    parser.add_argument("--min-rows", type=int, default=int(os.getenv("ML_MIN_ROWS", "30")))
    parser.add_argument("--min-positive", type=int, default=int(os.getenv("ML_MIN_POSITIVE", "2")))
    parser.add_argument("--max-actions", type=int, default=int(os.getenv("ML_MAX_ACTIONS", "100")))
    parser.add_argument("--action-threshold", type=float, default=float(os.getenv("ML_ACTION_THRESHOLD", "0.35")))
    parser.add_argument("--monitor-lookback-days", type=int, default=int(os.getenv("ML_MONITOR_LOOKBACK_DAYS", "7")))
    parser.add_argument("--retrain-lookback-days", type=int, default=int(os.getenv("ML_RETRAIN_LOOKBACK_DAYS", "90")))
    parser.add_argument("--min-monitor-rows", type=int, default=int(os.getenv("ML_MIN_MONITOR_ROWS", "30")))
    parser.add_argument("--drift-warning-threshold", type=float, default=float(os.getenv("ML_DRIFT_WARNING_THRESHOLD", "0.10")))
    parser.add_argument("--drift-threshold", type=float, default=float(os.getenv("ML_DRIFT_THRESHOLD", "0.25")))
    parser.add_argument("--no-retrain-on-drift", action="store_true")
    parser.add_argument("--force-retrain", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = PipelineConfig(
        site_id=args.site_id,
        lookback_days=args.lookback_days,
        min_rows=args.min_rows,
        min_positive=args.min_positive,
        max_actions=args.max_actions,
        action_threshold=args.action_threshold,
        monitor_lookback_days=args.monitor_lookback_days,
        retrain_lookback_days=args.retrain_lookback_days,
        min_monitor_rows=args.min_monitor_rows,
        drift_warning_threshold=args.drift_warning_threshold,
        drift_threshold=args.drift_threshold,
        retrain_on_drift=not args.no_retrain_on_drift,
        force_retrain=args.force_retrain,
    )
    result = run_monitoring_pipeline(config) if args.mode == "monitor" else run_pipeline(config)
    print(json.dumps(result, indent=2, default=json_default))


if __name__ == "__main__":
    main()
