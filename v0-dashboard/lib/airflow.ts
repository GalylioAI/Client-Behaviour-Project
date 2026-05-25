const DEFAULT_AIRFLOW_API_URL = "http://192.168.1.109:8090"
const DEFAULT_LAYER2_DAG_ID = "behavior_layer2_test_refresh"

function basicAuthHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
}

function safeDagRunPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
}

export async function triggerLayer2Refresh(siteId: string, lookbackHours: number) {
  const baseUrl = (process.env.AIRFLOW_API_URL || DEFAULT_AIRFLOW_API_URL).replace(/\/+$/, "")
  const dagId = process.env.AIRFLOW_LAYER2_DAG_ID || DEFAULT_LAYER2_DAG_ID
  const username = process.env.AIRFLOW_API_USERNAME || "admin"
  const password = process.env.AIRFLOW_API_PASSWORD || "changeme"
  const safeLookbackHours = Number.isFinite(lookbackHours) && lookbackHours > 0 ? Math.min(Math.round(lookbackHours), 24 * 14) : 24
  const dagRunId = `manual__${safeDagRunPart(siteId)}__${Date.now()}`

  const response = await fetch(`${baseUrl}/api/v1/dags/${encodeURIComponent(dagId)}/dagRuns`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(username, password),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dag_run_id: dagRunId,
      conf: {
        site_id: siteId,
        lookback_hours: safeLookbackHours,
        ensure_schema: "true",
      },
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Airflow trigger failed: ${response.status} ${detail.slice(0, 500)}`)
  }

  const data = await response.json()
  return {
    dag_id: String(data.dag_id || dagId),
    dag_run_id: String(data.dag_run_id || dagRunId),
    state: String(data.state || "queued"),
    lookback_hours: safeLookbackHours,
  }
}
