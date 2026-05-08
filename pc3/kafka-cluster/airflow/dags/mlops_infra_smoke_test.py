#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime, timezone

from airflow import DAG
from airflow.operators.python import PythonOperator


def check_http(name: str, url: str) -> None:
    with urllib.request.urlopen(url, timeout=10) as response:
        body = response.read(300).decode("utf-8", errors="replace")
        result = {
            "name": name,
            "url": url,
            "status": response.status,
            "body": body,
        }
        print(json.dumps(result, indent=2))
        if response.status >= 400:
            raise RuntimeError(f"{name} returned HTTP {response.status}")


def check_minio() -> None:
    endpoint = os.getenv("MLOPS_MINIO_ENDPOINT", "http://192.168.1.106:9002").rstrip("/")
    check_http("minio", f"{endpoint}/minio/health/live")


def check_mlflow() -> None:
    uri = os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000").rstrip("/")
    check_http("mlflow", f"{uri}/health")


with DAG(
    dag_id="mlops_infra_smoke_test",
    description="Smoke-test the MLOps services without touching ClickHouse.",
    start_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
    schedule=None,
    catchup=False,
    tags=["mlops", "infra", "smoke-test"],
) as dag:
    PythonOperator(
        task_id="check_minio",
        python_callable=check_minio,
    )

    PythonOperator(
        task_id="check_mlflow",
        python_callable=check_mlflow,
    )
