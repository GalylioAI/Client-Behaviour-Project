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


def request_json(method: str, path: str, payload: dict[str, Any] | None = None, timeout: int = 1800) -> dict[str, Any]:
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


def run_hybrid_decision_pipeline(**context: Any) -> None:
    dag_run = context.get("dag_run")
    conf = dict(getattr(dag_run, "conf", None) or {})
    payload = {
        "site_id": conf.get("site_id"),
        "lookback_days": conf.get("lookback_days", 30),
        "min_rows": conf.get("min_rows", 30),
        "min_positive": conf.get("min_positive", 2),
        "max_actions": conf.get("max_actions", 100),
        "action_threshold": conf.get("action_threshold", 0.35),
    }
    result = request_json("POST", "/run", payload=payload, timeout=int(conf.get("timeout_seconds", 1800)))
    if result.get("status") != "completed":
        raise RuntimeError(f"ML pipeline failed: {json.dumps(result, ensure_ascii=False)}")


with DAG(
    dag_id="hybrid_decision_mlops_pipeline",
    description="Manually train one purchase-intent model per site, compare it with rules, and prepare smart actions.",
    start_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
    schedule=None,
    catchup=False,
    tags=["mlops", "purchase-intent", "smart-actions"],
) as dag:
    health = PythonOperator(
        task_id="check_mlops_runner",
        python_callable=check_runner,
    )

    run_pipeline = PythonOperator(
        task_id="train_score_and_prepare_actions",
        python_callable=run_hybrid_decision_pipeline,
    )

    health >> run_pipeline
