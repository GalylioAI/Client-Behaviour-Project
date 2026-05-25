import uuid

from fastapi import Request

from clickhouse_client import clickhouse_datetime, clickhouse_insert_json
from config import INGEST_AUDIT_ENABLED, WORKER_ID, log
from normalization import as_dict
from tenant_registry import extract_platform, extract_site_id, extract_source, extract_write_key


def sample_event(events: list) -> dict:
    if events and isinstance(events[0], dict):
        return events[0]
    return {}


def safe_preview(value: str, limit: int = 500) -> str:
    return value[:limit] if value else ""


async def audit_ingest_request(
    request: Request,
    envelope: dict,
    events: list,
    *,
    received_at: str,
    client_ip: str,
    status: str,
    http_status: int,
    reason: str = "",
    is_unload: bool = False,
    sent: int = 0,
    failed: int = 0,
) -> None:
    if not INGEST_AUDIT_ENABLED:
        return

    try:
        event = sample_event(events)
        page = as_dict(event.get("page"))
        props = as_dict(event.get("properties"))
        source = extract_source(envelope, events) or str(event.get("source") or envelope.get("source") or "")
        write_key = extract_write_key(request, envelope, events)
        row = {
            "audit_id": str(uuid.uuid4()),
            "received_at": clickhouse_datetime(received_at),
            "worker": WORKER_ID,
            "status": status,
            "http_status": int(http_status),
            "site_id": extract_site_id(envelope, events),
            "platform": extract_platform(envelope, events),
            "source": source,
            "client_ip": client_ip,
            "origin": safe_preview(request.headers.get("origin", "")),
            "referer": safe_preview(request.headers.get("referer", "")),
            "user_agent": safe_preview(request.headers.get("user-agent", "")),
            "event_count": len(events),
            "sent_count": int(sent),
            "failed_count": int(failed),
            "is_unload": 1 if is_unload else 0,
            "reason": safe_preview(str(reason), 500),
            "key_present": 1 if write_key else 0,
            "key_prefix": write_key[:16] if write_key else "",
            "sample_event_name": safe_preview(str(event.get("event_name") or event.get("event") or event.get("name") or "")),
            "sample_event_type": safe_preview(str(event.get("event_type") or event.get("event_category") or event.get("category") or "")),
            "sample_page_url": safe_preview(str(page.get("url") or event.get("page_url") or event.get("url") or props.get("url") or ""), 500),
        }
        await clickhouse_insert_json("tracer.event_ingest_audit", row)
    except Exception as exc:
        log.warning("Ingest audit write failed | status=%s reason=%s error=%s", status, reason, exc)
