import json
import uuid


RESERVED_EVENT_KEYS = {
    "schema_version",
    "event_id",
    "event",
    "event_name",
    "name",
    "event_type",
    "event_category",
    "category",
    "timestamp",
    "session_id",
    "visitor_id",
    "user_id",
    "customer_id",
    "customer_email",
    "page",
    "page_url",
    "url",
    "page_type",
    "page_title",
    "referrer_url",
    "referrer",
    "source",
    "platform",
    "site_id",
    "siteId",
    "website_id",
    "context",
    "properties",
    "data",
    "write_key",
    "public_write_key",
    "server_secret_key",
    "api_key",
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
        raw.get("site_id")
        or raw.get("siteId")
        or raw.get("website_id")
        or envelope.get("site_id")
        or envelope.get("siteId")
        or envelope.get("website_id")
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
        "event_id": event_id,
        "event_type": event_category,
        "event_name": event_name,
        "received_at": received_at,
        "timestamp": raw.get("timestamp") or received_at,
        "session_id": raw.get("session_id") or "",
        "user_id": raw.get("visitor_id") or raw.get("user_id") or "",
        "customer_id": raw.get("customer_id") or props.get("customer_id") or "",
        "customer_email": raw.get("customer_email") or props.get("customer_email") or "",
        "page_url": page_url,
        "page_type": page_type,
        "source": source,
        "is_unload": 1 if is_unload else 0,
        "site_id": site_id,
        "platform": platform,
        "location": json.dumps(location),
        "properties": json.dumps(props) if props else "{}",
        "context": json.dumps(context) if context else "{}",
        "raw_event": json.dumps(standard_raw),
    }


def validate_event(event: dict) -> str | None:
    if not isinstance(event, dict):
        return "event must be a JSON object"
    if not (event.get("event_category") or event.get("event_type") or event.get("event_name") or event.get("event")):
        return "missing required field: event_name or event_category"
    return None
