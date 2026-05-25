from __future__ import annotations

import base64
import hashlib
import json
import os
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

import pandas as pd


DEFAULT_CLICKHOUSE_URL = "http://admin:changeme@192.168.1.106:8123/tracer"
RUNTIME_DIR = Path(os.getenv("MLOPS_RUNTIME_DIR", "/workspace/runtime"))
DVC_WORKSPACE = Path(os.getenv("DVC_WORKSPACE", str(RUNTIME_DIR / "dvc-workspace")))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def format_dt(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def json_default(value: object) -> object:
    if isinstance(value, datetime):
        return format_dt(value)
    if hasattr(value, "item"):
        return value.item()
    return str(value)


def stable_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sql_string(value: object) -> str:
    text = "" if value is None else str(value)
    return "'" + text.replace("\\", "\\\\").replace("'", "\\'") + "'"


def run_command(args: list[str], cwd: Path | None = None, timeout: int = 600) -> tuple[int, str]:
    try:
        completed = subprocess.run(
            args,
            cwd=str(cwd) if cwd else None,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            check=False,
        )
        return completed.returncode, completed.stdout
    except Exception as exc:
        return 1, f"{type(exc).__name__}: {exc}"


def ensure_dvc_remote() -> tuple[str, str]:
    remote_url = os.getenv("DVC_REMOTE_URL", "s3://dvc")
    remote_name = os.getenv("DVC_REMOTE_NAME", "minio")
    endpoint = os.getenv("MLOPS_MINIO_ENDPOINT", "http://192.168.1.106:9002")

    DVC_WORKSPACE.mkdir(parents=True, exist_ok=True)
    if not (DVC_WORKSPACE / ".dvc").exists():
        code, output = run_command(["dvc", "init", "--no-scm"], cwd=DVC_WORKSPACE)
        if code != 0:
            return "failed", output

    commands = [
        ["dvc", "remote", "add", "-d", "-f", remote_name, remote_url],
        ["dvc", "remote", "modify", remote_name, "endpointurl", endpoint],
    ]
    for command in commands:
        code, output = run_command(command, cwd=DVC_WORKSPACE)
        if code != 0:
            return "failed", output
    return "configured", f"{remote_name} -> {remote_url}"


def dvc_add_and_push(path: Path) -> tuple[str, str]:
    status, detail = ensure_dvc_remote()
    if status != "configured":
        return status, detail

    relative = path.relative_to(DVC_WORKSPACE)
    code, output = run_command(["dvc", "add", str(relative)], cwd=DVC_WORKSPACE, timeout=1200)
    if code != 0:
        return "failed", output
    code, output = run_command(["dvc", "push"], cwd=DVC_WORKSPACE, timeout=1800)
    if code != 0:
        return "failed", output
    return "pushed", output


@dataclass
class ClickHouseHttpClient:
    endpoint: str
    username: str | None = None
    password: str | None = None

    @classmethod
    def from_env(cls) -> "ClickHouseHttpClient":
        raw_url = os.getenv("CLICKHOUSE_URL") or os.getenv("AIRFLOW_CONN_CLICKHOUSE_DEFAULT") or DEFAULT_CLICKHOUSE_URL
        parsed = urlparse(raw_url)
        if not parsed.scheme or not parsed.hostname:
            raise ValueError(f"Invalid ClickHouse URL: {raw_url}")

        database = parsed.path.strip("/") or os.getenv("CLICKHOUSE_DATABASE", "tracer")
        port = f":{parsed.port}" if parsed.port else ""
        endpoint = f"{parsed.scheme}://{parsed.hostname}{port}/?{urlencode({'database': database})}"
        return cls(endpoint=endpoint, username=parsed.username or os.getenv("CLICKHOUSE_USER"), password=parsed.password or os.getenv("CLICKHOUSE_PASSWORD"))

    def execute(self, sql: str, timeout: int = 180) -> str:
        request = Request(self.endpoint, data=sql.strip().encode("utf-8"), method="POST")
        if self.username:
            token = f"{self.username}:{self.password or ''}".encode("utf-8")
            request.add_header("Authorization", "Basic " + base64.b64encode(token).decode("ascii"))
        try:
            with urlopen(request, timeout=timeout) as response:
                return response.read().decode("utf-8")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"ClickHouse error {exc.code}: {detail}\nSQL:\n{sql[:2000]}") from exc

    def query_json(self, sql: str) -> list[dict]:
        text = self.execute(sql.rstrip().rstrip(";") + "\nFORMAT JSONEachRow")
        return [json.loads(line) for line in text.splitlines() if line.strip()]

    def query_df(self, sql: str) -> pd.DataFrame:
        rows = self.query_json(sql)
        return pd.DataFrame(rows)

    def insert_json_each_row(self, table: str, rows: Iterable[dict], timeout: int = 300) -> int:
        payload = [json.dumps(row, ensure_ascii=False, default=json_default, separators=(",", ":")) for row in rows]
        if not payload:
            return 0
        self.execute(f"INSERT INTO {table} FORMAT JSONEachRow\n" + "\n".join(payload), timeout=timeout)
        return len(payload)


def split_sql(sql: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    in_single = False
    escaped = False
    for char in sql:
        current.append(char)
        if char == "\\" and in_single:
            escaped = not escaped
            continue
        if char == "'" and not escaped:
            in_single = not in_single
        escaped = False
        if char == ";" and not in_single:
            statement = "".join(current).strip().rstrip(";").strip()
            if statement and not statement.startswith("--"):
                statements.append(statement)
            current = []
    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements
