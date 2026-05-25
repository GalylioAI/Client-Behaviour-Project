import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse

from audit import audit_ingest_request
from config import (
    CORS_ALLOW_ORIGINS,
    INGEST_AUDIT_ENABLED,
    KAFKA_BROKERS,
    KAFKA_TOPIC,
    SITE_REGISTRY_COMPAT_ALLOW_MISSING_KEY,
    SITE_REGISTRY_ENABLED,
    WORKER_ID,
    log,
)
from cors import install_cors_middleware
from geo import get_location
from kafka_client import get_producer, send_to_dead_letter, send_to_kafka, stop_producer
from metrics import inc, prometheus_text, snapshot
from normalization import normalize_event, validate_event
from tenant_registry import validate_site_access


app = FastAPI(title="Kafka Bridge", version="2.0.0")
install_cors_middleware(app)


@app.get("/health")
async def health():
    metrics_snapshot = snapshot()
    received = metrics_snapshot.get("events_received_total", 0)
    sent = metrics_snapshot.get("events_sent_total", 0)
    failed = metrics_snapshot.get("events_failed_total", 0)
    stuck_events = max(received - sent - failed, 0)
    return {
        "status": "ok",
        "worker": WORKER_ID,
        "kafka_brokers": KAFKA_BROKERS,
        "topic": KAFKA_TOPIC,
        "cors_allow_origins": CORS_ALLOW_ORIGINS,
        "site_registry_enabled": SITE_REGISTRY_ENABLED,
        "site_registry_compat_allow_missing_key": SITE_REGISTRY_COMPAT_ALLOW_MISSING_KEY,
        "ingest_audit_enabled": INGEST_AUDIT_ENABLED,
        "events_received_total": received,
        "events_sent_total": sent,
        "events_failed_total": failed,
        "stuck_events_estimate": stuck_events,
        "kafka_errors_total": metrics_snapshot.get("kafka_errors_total", 0),
        "kafka_send_timeouts_total": metrics_snapshot.get("kafka_send_timeouts_total", 0),
        "kafka_producer_restarts_total": metrics_snapshot.get("kafka_producer_restarts_total", 0),
        "last_event_sent_unix": metrics_snapshot.get("last_event_sent_unix", 0),
        "last_kafka_error_unix": metrics_snapshot.get("last_kafka_error_unix", 0),
    }


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    """Prometheus scrape endpoint — labeled per worker so Grafana can show breakdown."""
    return PlainTextResponse(prometheus_text(), media_type="text/plain; version=0.0.4")


@app.post("/webhook")
async def webhook(request: Request):
    received_at = datetime.now(timezone.utc).isoformat()
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.client.host
    )

    try:
        data = await request.json()
    except Exception:
        log.warning("Invalid JSON | ip=%s", client_ip)
        await audit_ingest_request(
            request,
            {},
            [],
            received_at=received_at,
            client_ip=client_ip,
            status="rejected",
            http_status=400,
            reason="Invalid JSON body",
        )
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    if not isinstance(data, dict):
        log.warning("Invalid payload | ip=%s type=%s", client_ip, type(data).__name__)
        await audit_ingest_request(
            request,
            {},
            [],
            received_at=received_at,
            client_ip=client_ip,
            status="rejected",
            http_status=400,
            reason="JSON body must be an object",
        )
        raise HTTPException(status_code=400, detail="JSON body must be an object")

    envelope = data if isinstance(data, dict) else {}

    if "events" in data and isinstance(data["events"], list):
        events = data["events"]
        is_unload = bool(data.get("is_unload", False))
        log.info(
            "Batch | worker=%s ip=%s site=%s platform=%s count=%d is_unload=%s",
            WORKER_ID,
            client_ip,
            data.get("site_id") or data.get("website_id") or "",
            data.get("platform") or "",
            len(events),
            is_unload,
        )
    else:
        events = [data]
        is_unload = bool(data.get("is_unload", False))
        log.info("Single | worker=%s ip=%s type=%s", WORKER_ID, client_ip, data.get("event_type") or data.get("event", "?"))

    try:
        await validate_site_access(request, envelope, events)
    except HTTPException as exc:
        await audit_ingest_request(
            request,
            envelope,
            events,
            received_at=received_at,
            client_ip=client_ip,
            status="rejected",
            http_status=exc.status_code,
            reason=str(exc.detail),
            is_unload=is_unload,
        )
        raise

    inc("batches_received_total")
    inc("events_received_total", len(events))

    location = await get_location(client_ip)
    sent = 0
    failed = 0

    async def process(raw: dict):
        nonlocal sent, failed
        error = validate_event(raw)
        if error:
            await send_to_dead_letter(raw, reason=error)
            inc("events_failed_total")
            failed += 1
            return

        event = normalize_event(raw, envelope, location, received_at, is_unload)
        key = event.get("session_id") or event.get("user_id")
        try:
            await send_to_kafka(event, topic=KAFKA_TOPIC, key=key)
            inc("events_sent_total")
            sent += 1
        except Exception as exc:
            log.error("Kafka send failed | worker=%s error=%s", WORKER_ID, exc)
            inc("kafka_errors_total")
            inc("events_failed_total")
            await send_to_dead_letter(event, reason=str(exc))
            failed += 1

    await asyncio.gather(*[process(e) for e in events])
    log.info("Done | worker=%s sent=%d failed=%d ip=%s", WORKER_ID, sent, failed, client_ip)
    await audit_ingest_request(
        request,
        envelope,
        events,
        received_at=received_at,
        client_ip=client_ip,
        status="accepted" if sent else "dead_letter",
        http_status=200,
        reason="" if not failed else f"{failed} event(s) failed validation or Kafka send",
        is_unload=is_unload,
        sent=sent,
        failed=failed,
    )
    return {"status": "received", "sent": sent, "failed": failed}


@app.on_event("startup")
async def startup():
    log.info("Worker starting | worker=%s", WORKER_ID)
    try:
        await get_producer()
        log.info("Bridge ready | worker=%s topic=%s", WORKER_ID, KAFKA_TOPIC)
    except Exception as exc:
        log.error("Kafka connect failed | worker=%s error=%s", WORKER_ID, exc)


@app.on_event("shutdown")
async def shutdown():
    await stop_producer()
