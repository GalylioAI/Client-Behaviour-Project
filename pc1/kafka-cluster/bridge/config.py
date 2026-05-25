import logging
import os


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("bridge")

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "192.168.1.105:9092,192.168.1.106:9092,192.168.1.109:9092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "ecommerce.events")
DEAD_LETTER_TOPIC = os.getenv("DEAD_LETTER_TOPIC", "ecommerce.dead-letter")
KAFKA_PRODUCER_START_TIMEOUT_SECONDS = float(os.getenv("KAFKA_PRODUCER_START_TIMEOUT_SECONDS", "10"))
KAFKA_SEND_TIMEOUT_SECONDS = float(os.getenv("KAFKA_SEND_TIMEOUT_SECONDS", "8"))

GEO_API_URL = "http://ip-api.com/json/{ip}?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,query"
PRIVATE_PREFIXES = ("127.", "10.", "192.168.", "172.16.", "::1", "localhost")

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
SITE_REGISTRY_COMPAT_ALLOW_MISSING_KEY = os.getenv("SITE_REGISTRY_COMPAT_ALLOW_MISSING_KEY", "false").lower() in (
    "1",
    "true",
    "yes",
    "on",
)
SITE_REGISTRY_CACHE_TTL_SECONDS = int(os.getenv("SITE_REGISTRY_CACHE_TTL_SECONDS", "60"))
INGEST_AUDIT_ENABLED = os.getenv("INGEST_AUDIT_ENABLED", "true").lower() in ("1", "true", "yes", "on")

# Each uvicorn worker process gets its own identity and in-process counters.
WORKER_ID = f"worker_{os.getpid()}"
