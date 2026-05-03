import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

import httpx
from aiokafka import AIOKafkaProducer
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("bridge")

# ── Config ────────────────────────────────────────────────────────────────────
KAFKA_BROKERS     = os.getenv("KAFKA_BROKERS", "192.168.1.105:9092,192.168.1.106:9092,192.168.1.109:9092")
KAFKA_TOPIC       = os.getenv("KAFKA_TOPIC", "ecommerce.events")
DEAD_LETTER_TOPIC = os.getenv("DEAD_LETTER_TOPIC", "ecommerce.dead-letter")
GEO_API_URL       = "http://ip-api.com/json/{ip}?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,query"
PRIVATE_PREFIXES  = ("127.", "10.", "192.168.", "172.16.", "::1", "localhost")
CORS_ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOW_ORIGINS",
        "https://tdiscount.tn,https://www.tdiscount.tn,http://localhost,http://localhost:3000,http://localhost:8080",
    ).split(",")
    if origin.strip()
]

# Worker identity — each uvicorn worker process gets a unique ID based on PID
WORKER_ID = f"worker_{os.getpid()}"

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Kafka Bridge", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# ── Prometheus metrics ────────────────────────────────────────────────────────
# Each worker tracks its own counters independently.
# Prometheus sums them automatically using sum(metric) in queries.
# Labels include worker_id so you can see per-worker breakdown in Grafana.
_metrics = {
    "events_received_total":    0,
    "events_sent_total":        0,
    "events_failed_total":      0,
    "events_dead_letter_total": 0,
    "batches_received_total":   0,
    "geo_lookups_total":        0,
    "geo_cache_hits_total":     0,
    "kafka_errors_total":       0,
}
_start_time = time.time()

def inc(key: str, amount: int = 1):
    _metrics[key] += amount

def prometheus_text() -> str:
    descriptions = {
        "events_received_total":    ("counter", "Total events received by the webhook"),
        "events_sent_total":        ("counter", "Total events successfully sent to Kafka"),
        "events_failed_total":      ("counter", "Total events that failed validation or Kafka send"),
        "events_dead_letter_total": ("counter", "Total events sent to dead letter topic"),
        "batches_received_total":   ("counter", "Total webhook requests received"),
        "geo_lookups_total":        ("counter", "Total IP geolocation lookups performed"),
        "geo_cache_hits_total":     ("counter", "Total IP geolocation cache hits"),
        "kafka_errors_total":       ("counter", "Total Kafka send errors"),
    }
    lines = []
    for key, (mtype, help_text) in descriptions.items():
        metric_name = f"bridge_{key}"
        lines.append(f"# HELP {metric_name} {help_text}")
        lines.append(f"# TYPE {metric_name} {mtype}")
        # Label includes worker_id so Grafana can show per-worker breakdown
        # and sum() across workers for totals
        lines.append(f'{metric_name}{{worker="{WORKER_ID}"}} {_metrics[key]}')

    lines.append("# HELP bridge_uptime_seconds Seconds since this worker started")
    lines.append("# TYPE bridge_uptime_seconds gauge")
    lines.append(f'bridge_uptime_seconds{{worker="{WORKER_ID}"}} {time.time() - _start_time:.1f}')

    return "\n".join(lines) + "\n"

# ── Kafka producer ────────────────────────────────────────────────────────────
producer: AIOKafkaProducer | None = None

async def get_producer() -> AIOKafkaProducer:
    global producer
    if producer is None:
        producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BROKERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            acks="all",
            enable_idempotence=True,
            max_batch_size=65536,
            linger_ms=10,
            retry_backoff_ms=300,
        )
        await producer.start()
        log.info("Kafka producer started | worker=%s brokers=%s", WORKER_ID, KAFKA_BROKERS)
    return producer

# ── Geo cache ─────────────────────────────────────────────────────────────────
_geo_cache: dict = {}

async def get_location(ip: str) -> dict:
    if not ip or any(ip.startswith(p) for p in PRIVATE_PREFIXES):
        return {"ip": ip, "note": "private/local - no geolocation"}
    if ip in _geo_cache:
        inc("geo_cache_hits_total")
        return _geo_cache[ip]
    inc("geo_lookups_total")
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(GEO_API_URL.format(ip=ip))
            data = resp.json()
        if data.get("status") == "success":
            location = {
                "ip":           ip,
                "country":      data.get("country"),
                "country_code": data.get("countryCode"),
                "region":       data.get("regionName"),
                "city":         data.get("city"),
                "zip":          data.get("zip"),
                "lat":          data.get("lat"),
                "lon":          data.get("lon"),
                "timezone":     data.get("timezone"),
                "isp":          data.get("isp"),
                "org":          data.get("org"),
            }
            log.info("Geo OK | ip=%s city=%s country=%s", ip, location["city"], location["country"])
        else:
            location = {"ip": ip, "note": "geo lookup failed"}
    except Exception as exc:
        location = {"ip": ip, "note": f"geo error: {exc}"}
        log.warning("Geo error | ip=%s error=%s", ip, exc)
    _geo_cache[ip] = location
    return location

# ── Kafka helpers ─────────────────────────────────────────────────────────────
async def send_to_kafka(event: dict, topic: str, key: str | None = None):
    p = await get_producer()
    await p.send_and_wait(topic, value=event, key=key)

async def send_to_dead_letter(event: dict, reason: str):
    dead = {
        "original_event":     event,
        "dead_letter_reason": reason,
        "dead_letter_at":     datetime.now(timezone.utc).isoformat(),
    }
    try:
        p = await get_producer()
        await p.send_and_wait(DEAD_LETTER_TOPIC, value=dead)
        inc("events_dead_letter_total")
        event_type = event.get("event_type", "?") if isinstance(event, dict) else type(event).__name__
        log.warning("Dead letter | reason=%s type=%s", reason, event_type)
    except Exception as exc:
        log.error("DEAD LETTER FAILED | reason=%s error=%s event=%s", reason, exc, json.dumps(event))

# ── Event normalization ───────────────────────────────────────────────────────
RESERVED_EVENT_KEYS = {
    "schema_version", "event_id", "event", "event_name", "name", "event_type",
    "event_category", "category", "timestamp", "session_id", "visitor_id",
    "user_id", "customer_id", "customer_email", "page", "page_url", "url",
    "page_type", "page_title", "referrer_url", "referrer", "source", "platform",
    "site_id", "siteId", "website_id", "context", "properties", "data",
}
KNOWN_PLATFORMS = {"wordpress", "woocommerce", "prestashop", "shopify", "magento", "custom"}
KNOWN_SOURCES = {"client_js", "server_php", "js", "php", "backend", "api"}

def as_dict(value) -> dict:
    return value if isinstance(value, dict) else {}

def normalize_category(category: str | None, event_name: str | None = "") -> str:
    value = (category or "").lower()
    name = (event_name or "").lower()

    if "session" in value or "navigation" in value:
        return "session_navigation"
    if "product" in value:
        return "product"
    if "cart" in value:
        return "cart"
    if "checkout" in value or "purchase" in value or "payment" in value:
        return "checkout"
    if "account" in value or "user" in value:
        return "account"
    if "search" in value or "filter" in value:
        return "search"
    if "marketing" in value or "promotional" in value:
        return "marketing"

    if "product" in name:
        return "product"
    if "cart" in name or "coupon" in name:
        return "cart"
    if "checkout" in name or "purchase" in name or "payment" in name or "shipping" in name:
        return "checkout"
    if any(token in name for token in ("login", "logout", "registration", "password", "profile", "wishlist", "address")):
        return "account"
    if "search" in name or "filter" in name or "sort" in name:
        return "search"
    if any(token in name for token in ("newsletter", "banner", "popup", "social")):
        return "marketing"

    return "custom"

def extract_properties(raw: dict) -> dict:
    props = {}
    raw_props = raw.get("properties")
    raw_data = raw.get("data")
    if isinstance(raw_props, dict):
        props.update(raw_props)
    elif raw_props not in (None, ""):
        props["properties"] = raw_props

    if isinstance(raw_data, dict):
        props.update(raw_data)
    elif raw_data not in (None, ""):
        props["data"] = raw_data

    for key, value in raw.items():
        if key not in RESERVED_EVENT_KEYS and value is not None:
            props[key] = value

    return props

def normalize_event(raw: dict, envelope: dict, location: dict, received_at: str, is_unload: bool) -> dict:
    page = as_dict(raw.get("page"))
    props = extract_properties(raw)
    context = as_dict(raw.get("context"))

    event_name = raw.get("event_name") or raw.get("event") or raw.get("name") or "unknown"
    event_category = normalize_category(
        raw.get("event_category") or raw.get("event_type") or raw.get("category"),
        event_name,
    )
    schema_version = raw.get("schema_version") or envelope.get("schema_version") or "1.0"
    site_id = (
        raw.get("site_id") or raw.get("siteId") or raw.get("website_id")
        or envelope.get("site_id") or envelope.get("siteId") or envelope.get("website_id")
        or ""
    )
    raw_platform = raw.get("platform")
    raw_source = raw.get("source")
    platform = (
        raw_platform
        if isinstance(raw_platform, str) and raw_platform.lower() in KNOWN_PLATFORMS
        else envelope.get("platform") or ""
    )
    source = (
        raw_source
        if isinstance(raw_source, str) and raw_source.lower() in KNOWN_SOURCES
        else envelope.get("source") or "client_js"
    )

    if raw_platform and (not isinstance(raw_platform, str) or raw_platform.lower() not in KNOWN_PLATFORMS):
        props.setdefault("platform", raw_platform)
    if raw_source and (not isinstance(raw_source, str) or raw_source.lower() not in KNOWN_SOURCES):
        props.setdefault("source", raw_source)
    page_url = page.get("url") or raw.get("page_url") or raw.get("url") or props.get("url") or ""
    page_type = page.get("type") or raw.get("page_type") or props.get("page_type") or ""
    event_id = raw.get("event_id") or str(uuid.uuid4())

    standard_raw = {
        "schema_version": schema_version,
        "site_id": site_id,
        "platform": platform,
        "source": source,
        "event_id": event_id,
        "event_name": event_name,
        "event_category": event_category,
        "timestamp": raw.get("timestamp") or received_at,
        "session_id": raw.get("session_id") or "",
        "visitor_id": raw.get("visitor_id") or raw.get("user_id") or "",
        "customer_id": raw.get("customer_id") or props.get("customer_id") or "",
        "customer_email": raw.get("customer_email") or props.get("customer_email") or "",
        "page": page,
        "properties": props,
        "context": context,
        "location": location,
    }

    return {
        "schema_version": schema_version,
        "event_id":       event_id,
        "event_type":     event_category,
        "event_name":     event_name,
        "received_at":    received_at,
        "timestamp":      raw.get("timestamp") or received_at,
        "session_id":     raw.get("session_id") or "",
        "user_id":        raw.get("visitor_id") or raw.get("user_id") or "",
        "customer_id":    raw.get("customer_id") or props.get("customer_id") or "",
        "customer_email": raw.get("customer_email") or props.get("customer_email") or "",
        "page_url":       page_url,
        "page_type":      page_type,
        "source":         source,
        "is_unload":      1 if is_unload else 0,
        "site_id":        site_id,
        "platform":       platform,
        "location":       json.dumps(location),
        "properties":     json.dumps(props) if props else "{}",
        "context":        json.dumps(context) if context else "{}",
        "raw_event":      json.dumps(standard_raw),
    }

def validate_event(event: dict) -> str | None:
    if not isinstance(event, dict):
        return "event must be a JSON object"
    if not (event.get("event_category") or event.get("event_type") or event.get("event_name") or event.get("event")):
        return "missing required field: event_name or event_category"
    return None

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "worker": WORKER_ID,
        "kafka_brokers": KAFKA_BROKERS,
        "topic": KAFKA_TOPIC,
        "cors_allow_origins": CORS_ALLOW_ORIGINS,
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
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    if not isinstance(data, dict):
        log.warning("Invalid payload | ip=%s type=%s", client_ip, type(data).__name__)
        raise HTTPException(status_code=400, detail="JSON body must be an object")

    envelope = data if isinstance(data, dict) else {}

    if "events" in data and isinstance(data["events"], list):
        events    = data["events"]
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
        events    = [data]
        is_unload = bool(data.get("is_unload", False))
        log.info("Single | worker=%s ip=%s type=%s", WORKER_ID, client_ip, data.get("event_type") or data.get("event", "?"))

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
        key   = event.get("session_id") or event.get("user_id")
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
    return {"status": "received", "sent": sent, "failed": failed}

# ── Lifecycle ─────────────────────────────────────────────────────────────────
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
    global producer
    if producer:
        await producer.stop()
        log.info("Producer stopped | worker=%s", WORKER_ID)
