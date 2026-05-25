import hashlib
import hmac
import time
from urllib.parse import urlparse

from fastapi import HTTPException, Request

from clickhouse_client import clickhouse_json, sql_quote
from config import SITE_REGISTRY_CACHE_TTL_SECONDS, SITE_REGISTRY_COMPAT_ALLOW_MISSING_KEY, SITE_REGISTRY_ENABLED, log
from metrics import inc


_site_registry_cache: dict[str, tuple[float, dict | None]] = {}


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
        candidates.extend(
            [
                events[0].get("site_id"),
                events[0].get("siteId"),
                events[0].get("website_id"),
            ]
        )
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
        candidates.extend(
            [
                events[0].get("write_key"),
                events[0].get("public_write_key"),
                events[0].get("server_secret_key"),
                events[0].get("api_key"),
            ]
        )
    return next((str(value).strip() for value in candidates if value), "")


async def load_site_record(site_id: str) -> dict | None:
    now = time.time()
    cached = _site_registry_cache.get(site_id)
    if cached and now - cached[0] < SITE_REGISTRY_CACHE_TTL_SECONDS:
        return cached[1]

    site_rows = await clickhouse_json(
        f"""
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
    """
    )
    if not site_rows:
        _site_registry_cache[site_id] = (now, None)
        return None

    key_rows = await clickhouse_json(
        f"""
        SELECT key_type, key_hash, key_prefix, status
        FROM tracer.site_keys FINAL
        WHERE site_id = {sql_quote(site_id)}
          AND status = 'active'
          AND revoked_at IS NULL
    """
    )
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
