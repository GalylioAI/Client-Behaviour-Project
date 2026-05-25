#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

from airflow import DAG
from airflow.operators.python import PythonOperator


RUNNER_URL = os.getenv("MLOPS_RUNNER_URL", "http://mlops-runner:8600").rstrip("/")


def request_json(method: str, path: str, payload: dict[str, Any] | None = None, timeout: int = 3600) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{RUNNER_URL}{path}",
        data=body,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            parsed = json.loads(raw) if raw else {}
            print(json.dumps(parsed, indent=2, ensure_ascii=False))
            return parsed
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"ML runner returned HTTP {exc.code}: {raw}") from exc


def check_runner() -> None:
    request_json("GET", "/health", timeout=10)


def monitor_and_retrain_if_needed(**context: Any) -> None:
    dag_run = context.get("dag_run")
    conf = dict(getattr(dag_run, "conf", None) or {})
    payload = {
        "site_id": conf.get("site_id"),
        "lookback_days": conf.get("lookback_days", 30),
        "monitor_lookback_days": conf.get("monitor_lookback_days", 7),
        "retrain_lookback_days": conf.get("retrain_lookback_days", 90),
        "min_rows": conf.get("min_rows", 30),
        "min_positive": conf.get("min_positive", 2),
        "min_monitor_rows": conf.get("min_monitor_rows", 30),
        "max_actions": conf.get("max_actions", 100),
        "action_threshold": conf.get("action_threshold", 0.35),
        "drift_warning_threshold": conf.get("drift_warning_threshold", 0.10),
        "drift_threshold": conf.get("drift_threshold", 0.25),
        "retrain_on_drift": conf.get("retrain_on_drift", True),
        "force_retrain": conf.get("force_retrain", False),
    }
    result = request_json("POST", "/monitor", payload=payload, timeout=int(conf.get("timeout_seconds", 3600)))
    if result.get("status") != "completed":
        raise RuntimeError(f"ML monitoring pipeline failed: {json.dumps(result, ensure_ascii=False)}")


with DAG(
    dag_id="mlops_purchase_intent_monitoring",
    description="Periodically run drift checks with Deepchecks/custom PSI and retrain site models only when needed.",
    start_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
    schedule="15 */6 * * *",
    catchup=False,
    max_active_runs=1,
    tags=["mlops", "monitoring", "drift", "purchase-intent"],
) as dag:
    health = PythonOperator(
        task_id="check_mlops_runner",
        python_callable=check_runner,
    )

    monitor = PythonOperator(
        task_id="monitor_drift_and_retrain_if_needed",
        python_callable=monitor_and_retrain_if_needed,
    )

    health >> monitor
