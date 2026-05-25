from __future__ import annotations

import json
import os
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from .common import format_dt, json_default, utc_now
from .purchase_intent import PipelineConfig, run_monitoring_pipeline, run_pipeline


RUN_LOCK = threading.Lock()


def _int_value(payload: dict[str, Any], key: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(payload.get(key, default))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def _float_value(payload: dict[str, Any], key: str, default: float, minimum: float, maximum: float) -> float:
    try:
        value = float(payload.get(key, default))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def _bool_value(payload: dict[str, Any], key: str, default: bool) -> bool:
    value = payload.get(key, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def _config_from_payload(payload: dict[str, Any]) -> PipelineConfig:
    site_id = payload.get("site_id")
    site_id = str(site_id).strip() if site_id is not None else None
    return PipelineConfig(
        site_id=site_id or None,
        lookback_days=_int_value(payload, "lookback_days", int(os.getenv("ML_LOOKBACK_DAYS", "30")), 1, 365),
        min_rows=_int_value(payload, "min_rows", int(os.getenv("ML_MIN_ROWS", "30")), 1, 1000000),
        min_positive=_int_value(payload, "min_positive", int(os.getenv("ML_MIN_POSITIVE", "2")), 1, 1000000),
        max_actions=_int_value(payload, "max_actions", int(os.getenv("ML_MAX_ACTIONS", "100")), 0, 10000),
        action_threshold=_float_value(payload, "action_threshold", float(os.getenv("ML_ACTION_THRESHOLD", "0.35")), 0.0, 1.0),
        monitor_lookback_days=_int_value(payload, "monitor_lookback_days", int(os.getenv("ML_MONITOR_LOOKBACK_DAYS", "7")), 1, 365),
        retrain_lookback_days=_int_value(payload, "retrain_lookback_days", int(os.getenv("ML_RETRAIN_LOOKBACK_DAYS", "90")), 1, 730),
        min_monitor_rows=_int_value(payload, "min_monitor_rows", int(os.getenv("ML_MIN_MONITOR_ROWS", "30")), 1, 1000000),
        drift_warning_threshold=_float_value(payload, "drift_warning_threshold", float(os.getenv("ML_DRIFT_WARNING_THRESHOLD", "0.10")), 0.0, 10.0),
        drift_threshold=_float_value(payload, "drift_threshold", float(os.getenv("ML_DRIFT_THRESHOLD", "0.25")), 0.0, 10.0),
        retrain_on_drift=_bool_value(payload, "retrain_on_drift", os.getenv("ML_RETRAIN_ON_DRIFT", "true").lower() == "true"),
        force_retrain=_bool_value(payload, "force_retrain", False),
    )


class MLOpsRunnerHandler(BaseHTTPRequestHandler):
    server_version = "BehaviourAIMLOpsRunner/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}", flush=True)

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=json_default).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _payload(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0:
            return {}
        raw = self.rfile.read(content_length).decode("utf-8", errors="replace")
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError("Request body must be a JSON object.")
        return parsed

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/health":
            self._json(
                200,
                {
                    "status": "ok",
                    "service": "mlops-runner",
                    "time": format_dt(utc_now()),
                },
            )
            return
        self._json(404, {"status": "not_found", "path": path})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path not in {"/run", "/monitor"}:
            self._json(404, {"status": "not_found", "path": path})
            return

        try:
            payload = self._payload()
            config = _config_from_payload(payload)
        except Exception as exc:
            self._json(400, {"status": "bad_request", "error": f"{type(exc).__name__}: {exc}"})
            return

        if not RUN_LOCK.acquire(blocking=False):
            self._json(409, {"status": "busy", "message": "Another ML pipeline run is already in progress."})
            return

        try:
            result = run_monitoring_pipeline(config) if path == "/monitor" else run_pipeline(config)
            self._json(200, result)
        except Exception as exc:
            self._json(
                500,
                {
                    "status": "failed",
                    "error": f"{type(exc).__name__}: {exc}",
                    "traceback": traceback.format_exc()[-4000:],
                    "time": format_dt(utc_now()),
                },
            )
        finally:
            RUN_LOCK.release()


def main() -> None:
    port = int(os.getenv("MLOPS_RUNNER_PORT", "8600"))
    server = ThreadingHTTPServer(("0.0.0.0", port), MLOpsRunnerHandler)
    print(f"mlops-runner service listening on 0.0.0.0:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
