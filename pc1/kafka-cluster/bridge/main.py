import asyncio
import hashlib
import hmac
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

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
CLICKHOUSE_HTTP_URL = os.getenv(
    "CLICKHOUSE_HTTP_URL",
    "http://admin:changeme@192.168.1.106:8123/?database=tracer",
)
SITE_REGISTRY_ENABLED = os.getenv("SITE_REGISTRY_ENABLED", "false").lower() in ("1", "true", "yes", "on")
SITE_REGISTRY_COMPAT_ALLOW_MISSING_KEY = os.getenv("SITE_REGISTRY_COMPAT_ALLOW_MISSING_KEY", "false").lower() in ("1", "true", "yes", "on")
SITE_REGISTRY_CACHE_TTL_SECONDS = int(os.getenv("SITE_REGISTRY_CACHE_TTL_SECONDS", "60"))
INGEST_AUDIT_ENABLED = os.getenv("INGEST_AUDIT_ENABLED", "true").lower() in ("1", "true", "yes", "on")

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
    "events_auth_rejected_total": 0,
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
        "events_auth_rejected_total": ("counter", "Total events rejected by tenant/site/key validation"),
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
    "write_key", "public_write_key", "server_secret_key", "api_key",
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

# ── Tenant/site registry validation ──────────────────────────────────────────
_site_registry_cache: dict[str, tuple[float, dict | None]] = {}

def sql_quote(value: str) -> str:
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"

def hash_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def clean_origin(value: str | None) -> str:
    if not value:
        return ""
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        return value.rstrip("/")
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}".rstrip("/")

def origin_host(value: str | None) -> str:
    if not value:
        return ""
    parsed = urlparse(value)
    return (parsed.hostname or "").lower()

def extract_site_id(envelope: dict, events: list) -> str:
    candidates = [
        envelope.get("site_id"),
        envelope.get("siteId"),
        envelope.get("website_id"),
    ]
    if events and isinstance(events[0], dict):
        candidates.extend([
            events[0].get("site_id"),
            events[0].get("siteId"),
            events[0].get("website_id"),
        ])
    return next((str(value).strip() for value in candidates if value), "")

def extract_platform(envelope: dict, events: list) -> str:
    candidates = [envelope.get("platform")]
    if events and isinstance(events[0], dict):
        candidates.append(events[0].get("platform"))
    return next((str(value).strip().lower() for value in candidates if value), "")

def extract_source(envelope: dict, events: list) -> str:
    candidates = [envelope.get("source")]
    if events and isinstance(events[0], dict):
        candidates.append(events[0].get("source"))
    return next((str(value).strip().lower() for value in candidates if value), "")

def extract_write_key(request: Request, envelope: dict, events: list) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()

    for header in ("x-bt-write-key", "x-site-write-key", "x-api-key"):
        value = request.headers.get(header)
        if value:
            return value.strip()

    candidates = [
        envelope.get("write_key"),
        envelope.get("public_write_key"),
        envelope.get("server_secret_key"),
        envelope.get("api_key"),
    ]
    if events and isinstance(events[0], dict):
        candidates.extend([
            events[0].get("write_key"),
            events[0].get("public_write_key"),
            events[0].get("server_secret_key"),
            events[0].get("api_key"),
        ])
    return next((str(value).strip() for value in candidates if value), "")

async def clickhouse_json(sql: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=4) as client:
        response = await client.post(
            CLICKHOUSE_HTTP_URL,
            content=sql.strip() + "\nFORMAT JSONEachRow",
            headers={"Content-Type": "text/plain; charset=utf-8"},
        )
        response.raise_for_status()
    return [json.loads(line) for line in response.text.splitlines() if line.strip()]

async def clickhouse_insert_json(table: str, row: dict) -> None:
    if not INGEST_AUDIT_ENABLED:
        return
    async with httpx.AsyncClient(timeout=2) as client:
        response = await client.post(
            CLICKHOUSE_HTTP_URL,
            content=f"INSERT INTO {table} FORMAT JSONEachRow\n{json.dumps(row, default=str)}",
            headers={"Content-Type": "text/plain; charset=utf-8"},
        )
        response.raise_for_status()

def clickhouse_datetime(value: str) -> str:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    except Exception:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

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

async def load_site_record(site_id: str) -> dict | None:
    now = time.time()
    cached = _site_registry_cache.get(site_id)
    if cached and now - cached[0] < SITE_REGISTRY_CACHE_TTL_SECONDS:
        return cached[1]

    site_rows = await clickhouse_json(f"""
        SELECT
            site_id,
            tenant_id,
            domain,
            platform,
            allowed_origins,
            status,
            timezone
        FROM tracer.sites
        WHERE site_id = {sql_quote(site_id)}
        ORDER BY updated_at DESC
        LIMIT 1
    """)
    if not site_rows:
        _site_registry_cache[site_id] = (now, None)
        return None

    key_rows = await clickhouse_json(f"""
        SELECT key_type, key_hash, key_prefix, status
        FROM tracer.site_keys FINAL
        WHERE site_id = {sql_quote(site_id)}
          AND status = 'active'
          AND revoked_at IS NULL
    """)
    site = site_rows[0]
    site["keys"] = key_rows
    _site_registry_cache[site_id] = (now, site)
    return site

def is_origin_allowed(origin: str, referer: str, site: dict) -> bool:
    allowed = site.get("allowed_origins") or []
    if not allowed:
        return True

    candidates = [clean_origin(origin), clean_origin(referer)]
    candidate_hosts = {origin_host(origin), origin_host(referer)}
    for allowed_origin in allowed:
        allowed_clean = clean_origin(str(allowed_origin))
        allowed_host = origin_host(allowed_clean)
        if allowed_clean in candidates or (allowed_host and allowed_host in candidate_hosts):
            return True
    return False

def key_matches(site: dict, write_key: str, source: str) -> bool:
    if not write_key:
        return False
    incoming_hash = hash_key(write_key)
    expected_types = {"server_secret"} if source == "server_php" else {"public_write", "server_secret"}
    for key in site.get("keys", []):
        if key.get("key_type") not in expected_types:
            continue
        if hmac.compare_digest(str(key.get("key_hash") or ""), incoming_hash):
            return True
    return False

async def validate_site_access(request: Request, envelope: dict, events: list) -> dict | None:
    if not SITE_REGISTRY_ENABLED:
        return None

    site_id = extract_site_id(envelope, events)
    if not site_id:
        inc("events_auth_rejected_total", len(events))
        raise HTTPException(status_code=403, detail="Missing site_id")

    try:
        site = await load_site_record(site_id)
    except Exception as exc:
        log.error("Site registry lookup failed | site=%s error=%s", site_id, exc)
        raise HTTPException(status_code=503, detail="Site registry unavailable")

    if not site:
        inc("events_auth_rejected_total", len(events))
        raise HTTPException(status_code=403, detail="Unknown site_id")
    if str(site.get("status", "")).lower() != "active":
        inc("events_auth_rejected_total", len(events))
        raise HTTPException(status_code=403, detail="Site is inactive")

    platform = extract_platform(envelope, events)
    expected_platform = str(site.get("platform") or "").lower()
    if expected_platform and expected_platform != "custom" and platform and platform != expected_platform:
        inc("events_auth_rejected_total", len(events))
        raise HTTPException(status_code=403, detail="Platform does not match registered site")

    source = extract_source(envelope, events)
    write_key = extract_write_key(request, envelope, events)
    if source == "server_php":
        if key_matches(site, write_key, source):
            return site

        inc("events_auth_rejected_total", len(events))
        raise HTTPException(status_code=401, detail="Invalid or missing server secret key")

    origin = request.headers.get("origin", "")
    referer = request.headers.get("referer", "")
    if not is_origin_allowed(origin, referer, site):
        inc("events_auth_rejected_total", len(events))
        raise HTTPException(status_code=403, detail="Origin is not allowed for this site")

    if key_matches(site, write_key, source):
        return site

    if not write_key and SITE_REGISTRY_COMPAT_ALLOW_MISSING_KEY and (origin or referer):
        log.warning("Compat auth allowed without write_key | site=%s origin=%s referer=%s", site_id, origin, referer)
        return site

    inc("events_auth_rejected_total", len(events))
    raise HTTPException(status_code=401, detail="Invalid or missing write key")

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "worker": WORKER_ID,
        "kafka_brokers": KAFKA_BROKERS,
        "topic": KAFKA_TOPIC,
        "cors_allow_origins": CORS_ALLOW_ORIGINS,
        "site_registry_enabled": SITE_REGISTRY_ENABLED,
        "site_registry_compat_allow_missing_key": SITE_REGISTRY_COMPAT_ALLOW_MISSING_KEY,
        "ingest_audit_enabled": INGEST_AUDIT_ENABLED,
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
