import json
from datetime import datetime, timezone

import httpx

from config import CLICKHOUSE_HTTP_URL, INGEST_AUDIT_ENABLED


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


def sql_quote(value: str) -> str:
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"
