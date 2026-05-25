import time

from fastapi import Request
from fastapi.responses import Response

from clickhouse_client import clickhouse_json
from config import CORS_ALLOW_ORIGINS, SITE_REGISTRY_CACHE_TTL_SECONDS, SITE_REGISTRY_ENABLED, log
from tenant_registry import clean_origin


DEFAULT_CORS_HEADERS = "Content-Type, Authorization, X-Requested-With, X-BT-Write-Key, X-Site-Write-Key, X-API-Key"
_cors_origin_cache: tuple[float, set[str]] = (0, set())


def cors_response_headers(origin: str, requested_headers: str = "") -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": requested_headers or DEFAULT_CORS_HEADERS,
        "Access-Control-Max-Age": "600",
        "Vary": "Origin",
    }


async def load_allowed_cors_origins() -> set[str]:
    global _cors_origin_cache

    now = time.time()
    if now - _cors_origin_cache[0] < SITE_REGISTRY_CACHE_TTL_SECONDS:
        return _cors_origin_cache[1]

    origins = {clean_origin(origin) for origin in CORS_ALLOW_ORIGINS if clean_origin(origin)}
    if SITE_REGISTRY_ENABLED:
        try:
            rows = await clickhouse_json(
                """
                SELECT arrayJoin(allowed_origins) AS origin
                FROM tracer.sites
                WHERE status = 'active'
            """
            )
            origins.update(clean_origin(str(row.get("origin") or "")) for row in rows)
            origins.discard("")
        except Exception as exc:
            log.warning("CORS registry lookup failed | error=%s", exc)

    _cors_origin_cache = (now, origins)
    return origins


async def is_cors_origin_allowed(origin: str) -> bool:
    cleaned = clean_origin(origin)
    if not cleaned:
        return False
    return cleaned in await load_allowed_cors_origins()


def install_cors_middleware(app):
    @app.middleware("http")
    async def tenant_cors_middleware(request: Request, call_next):
        origin = request.headers.get("origin", "")
        if not origin:
            return await call_next(request)

        requested_headers = request.headers.get("access-control-request-headers", "")
        if await is_cors_origin_allowed(origin):
            headers = cors_response_headers(origin, requested_headers)
            if request.method == "OPTIONS":
                return Response(status_code=200, headers=headers)
            response = await call_next(request)
            response.headers.update(headers)
            return response

        if request.method == "OPTIONS":
            log.warning("CORS rejected | origin=%s path=%s", origin, request.url.path)
            return Response(status_code=400)

        return await call_next(request)
