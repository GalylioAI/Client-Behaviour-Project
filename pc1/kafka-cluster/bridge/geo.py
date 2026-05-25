import httpx

from config import GEO_API_URL, PRIVATE_PREFIXES, log
from metrics import inc


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
                "ip": ip,
                "country": data.get("country"),
                "country_code": data.get("countryCode"),
                "region": data.get("regionName"),
                "city": data.get("city"),
                "zip": data.get("zip"),
                "lat": data.get("lat"),
                "lon": data.get("lon"),
                "timezone": data.get("timezone"),
                "isp": data.get("isp"),
                "org": data.get("org"),
            }
            log.info("Geo OK | ip=%s city=%s country=%s", ip, location["city"], location["country"])
        else:
            location = {"ip": ip, "note": "geo lookup failed"}
    except Exception as exc:
        location = {"ip": ip, "note": f"geo error: {exc}"}
        log.warning("Geo error | ip=%s error=%s", ip, exc)

    _geo_cache[ip] = location
    return location
