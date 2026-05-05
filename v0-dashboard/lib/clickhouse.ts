type ClickHouseRow = Record<string, unknown>

const DEFAULT_CLICKHOUSE_URL = "http://admin:changeme@192.168.1.106:8123/tracer"

function getConnection() {
  const raw = process.env.CLICKHOUSE_URL || DEFAULT_CLICKHOUSE_URL
  const parsed = new URL(raw)
  const database = parsed.pathname.replace(/^\/+/, "") || process.env.CLICKHOUSE_DATABASE || "tracer"
  const endpoint = `${parsed.protocol}//${parsed.host}/?database=${encodeURIComponent(database)}`
  const username = decodeURIComponent(parsed.username || process.env.CLICKHOUSE_USER || "")
  const password = decodeURIComponent(parsed.password || process.env.CLICKHOUSE_PASSWORD || "")
  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
  }

  if (username) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
  }

  return { endpoint, headers }
}

export async function clickhouseQuery<T extends ClickHouseRow = ClickHouseRow>(sql: string): Promise<T[]> {
  const { endpoint, headers } = getConnection()
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: `${sql.trim().replace(/;$/, "")}\nFORMAT JSONEachRow`,
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`ClickHouse query failed: ${response.status} ${detail}`)
  }

  const text = await response.text()
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

export async function clickhouseCommand(sql: string): Promise<string> {
  const { endpoint, headers } = getConnection()
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: sql.trim().replace(/;$/, ""),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`ClickHouse command failed: ${response.status} ${detail}`)
  }

  return response.text()
}

export async function clickhouseInsertJson(table: string, row: Record<string, unknown>): Promise<string> {
  const { endpoint, headers } = getConnection()
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: `INSERT INTO ${table} FORMAT JSONEachRow\n${JSON.stringify(row)}`,
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`ClickHouse insert failed: ${response.status} ${detail}`)
  }

  return response.text()
}

export function sqlString(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

export function sqlArray(values: string[]) {
  return `[${values.map((value) => sqlString(value)).join(", ")}]`
}

export function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function str(value: unknown, fallback = "") {
  return value == null || value === "" ? fallback : String(value)
}
