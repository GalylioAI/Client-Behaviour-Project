#!/usr/bin/env python3
"""Register a SaaS tenant/site and generate tracker keys.

The raw keys are printed once for the customer/plugin setup. ClickHouse stores
only SHA-256 hashes so leaked database rows are not enough to send events.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import secrets
import sys
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse, urlunparse
from urllib.request import Request, urlopen


DEFAULT_CLICKHOUSE_URL = "http://admin:changeme@127.0.0.1:8123/?database=tracer"
VALID_PLATFORMS = {"wordpress", "prestashop", "shopify", "magento", "custom"}


def sql_quote(value: str) -> str:
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def sql_array(values: list[str]) -> str:
    return "[" + ", ".join(sql_quote(value) for value in values) + "]"


def key_hash(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def make_key(prefix: str) -> str:
    return f"{prefix}{secrets.token_hex(24)}"


def default_origins(domain: str) -> list[str]:
    clean = domain.removeprefix("https://").removeprefix("http://").strip("/")
    origins = [f"https://{clean}"]
    if not clean.startswith("www."):
        origins.append(f"https://www.{clean}")
    return origins


def normalize_origins(origins: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for origin in origins:
        parsed = urlparse(origin)
        if parsed.scheme and parsed.netloc:
            value = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}".rstrip("/")
        else:
            value = origin.rstrip("/").lower()
        if value and value not in seen:
            seen.add(value)
            normalized.append(value)
    return normalized


def clickhouse_request(url: str, sql: str) -> str:
    parsed = urlparse(url)
    headers = {"Content-Type": "text/plain; charset=utf-8"}
    request_url = url

    if parsed.username or parsed.password:
        username = unquote(parsed.username or "")
        password = unquote(parsed.password or "")
        token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
        headers["Authorization"] = f"Basic {token}"
        request_url = urlunparse(
            (
                parsed.scheme,
                parsed.hostname + (f":{parsed.port}" if parsed.port else ""),
                parsed.path,
                parsed.params,
                parsed.query,
                parsed.fragment,
            )
        )

    request = Request(request_url, data=sql.encode("utf-8"), headers=headers, method="POST")
    with urlopen(request, timeout=10) as response:
        return response.read().decode("utf-8")


def build_sql(args: argparse.Namespace, public_key: str, server_key: str, origins: list[str]) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    tenant_name = args.tenant_name or args.tenant_id
    public_hash = key_hash(public_key)
    server_hash = key_hash(server_key)

    return f"""
INSERT INTO tenants
    (tenant_id, name, plan, status, created_at, updated_at)
VALUES
    ({sql_quote(args.tenant_id)}, {sql_quote(tenant_name)}, {sql_quote(args.plan)}, 'active', now64(3), now64(3));

INSERT INTO sites
    (site_id, tenant_id, domain, platform, allowed_origins, timezone, status, plan, created_at, updated_at)
VALUES
    (
        {sql_quote(args.site_id)},
        {sql_quote(args.tenant_id)},
        {sql_quote(args.domain)},
        {sql_quote(args.platform)},
        {sql_array(origins)},
        {sql_quote(args.timezone)},
        'active',
        {sql_quote(args.plan)},
        now64(3),
        now64(3)
    );

INSERT INTO site_keys
    (key_id, site_id, key_type, key_prefix, key_hash, status, created_at, revoked_at, updated_at)
VALUES
    (
        {sql_quote(f"key_{args.site_id}_public_{timestamp}")},
        {sql_quote(args.site_id)},
        'public_write',
        {sql_quote(public_key[:16])},
        {sql_quote(public_hash)},
        'active',
        now64(3),
        NULL,
        now64(3)
    ),
    (
        {sql_quote(f"key_{args.site_id}_server_{timestamp}")},
        {sql_quote(args.site_id)},
        'server_secret',
        {sql_quote(server_key[:16])},
        {sql_quote(server_hash)},
        'active',
        now64(3),
        NULL,
        now64(3)
    );
""".strip()


def sql_statements(sql: str) -> list[str]:
    return [statement.strip() for statement in sql.split(";") if statement.strip()]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Register a tenant/site for the behaviour tracker SaaS.")
    parser.add_argument("--clickhouse-url", default=os.getenv("CLICKHOUSE_HTTP_URL", DEFAULT_CLICKHOUSE_URL))
    parser.add_argument("--tenant-id", required=True, help="Stable customer id, for example tenant_acme")
    parser.add_argument("--tenant-name", help="Human-readable customer name")
    parser.add_argument("--site-id", required=True, help="Stable website id used by the plugin")
    parser.add_argument("--domain", required=True, help="Website domain, for example acme.tn")
    parser.add_argument("--platform", required=True, choices=sorted(VALID_PLATFORMS))
    parser.add_argument("--origin", action="append", dest="origins", help="Allowed browser origin. Repeatable.")
    parser.add_argument("--timezone", default="UTC")
    parser.add_argument("--plan", default="starter")
    parser.add_argument("--public-key", help="Optional existing public write key")
    parser.add_argument("--server-key", help="Optional existing server secret key")
    parser.add_argument("--dry-run", action="store_true", help="Print output without inserting into ClickHouse")
    parser.add_argument("--print-sql", action="store_true", help="Print the SQL that will be executed")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    origins = normalize_origins(args.origins or default_origins(args.domain))
    public_key = args.public_key or make_key("pk_live_")
    server_key = args.server_key or make_key("sk_live_")
    sql = build_sql(args, public_key, server_key, origins)

    if args.print_sql:
        print(sql)

    if not args.dry_run:
        for statement in sql_statements(sql):
            clickhouse_request(args.clickhouse_url, statement)

    result = {
        "tenant_id": args.tenant_id,
        "site_id": args.site_id,
        "domain": args.domain,
        "platform": args.platform,
        "allowed_origins": origins,
        "public_write_key": public_key,
        "server_secret_key": server_key,
        "inserted": not args.dry_run,
    }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Site registered: {args.site_id} ({args.platform})")
        print(f"Tenant: {args.tenant_id}")
        print(f"Allowed origins: {', '.join(origins)}")
        print(f"Public write key: {public_key}")
        print(f"Server secret key: {server_key}")
        print("Save these raw keys now; ClickHouse only stores their hashes.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
