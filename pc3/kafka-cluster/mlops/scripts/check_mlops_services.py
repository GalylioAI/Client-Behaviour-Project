#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def check(name: str, url: str) -> dict[str, object]:
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            body = response.read(300).decode("utf-8", errors="replace")
            return {
                "name": name,
                "url": url,
                "ok": 200 <= response.status < 400,
                "status": response.status,
                "body": body,
            }
    except urllib.error.HTTPError as exc:
        return {"name": name, "url": url, "ok": False, "status": exc.code, "body": exc.reason}
    except Exception as exc:
        return {"name": name, "url": url, "ok": False, "status": None, "body": str(exc)}


def main() -> int:
    minio_endpoint = os.getenv("MLOPS_MINIO_ENDPOINT", "http://192.168.1.106:9002").rstrip("/")
    mlflow_uri = os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000").rstrip("/")
    checks = [
        check("minio", f"{minio_endpoint}/minio/health/live"),
        check("mlflow", f"{mlflow_uri}/health"),
    ]
    print(json.dumps({"checks": checks}, indent=2))
    return 0 if all(item["ok"] for item in checks) else 1


if __name__ == "__main__":
    sys.exit(main())
