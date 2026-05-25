import { NextResponse } from "next/server"

import { getSessionFromRequest } from "@/lib/auth"
import { canAccessSite } from "@/lib/tenant-access"
import { triggerLayer2Refresh } from "@/lib/airflow"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const body = await request.json()
    const siteId = String(body.site_id || "").trim()
    const lookbackHours = Number(body.lookback_hours || process.env.AIRFLOW_LAYER2_LOOKBACK_HOURS || 24)

    if (!siteId) {
      return NextResponse.json({ error: "site_id is required." }, { status: 400 })
    }

    const allowed = await canAccessSite(session.tenant_id, siteId)
    if (!allowed) {
      return NextResponse.json({ error: "You do not have access to this site." }, { status: 403 })
    }

    const run = await triggerLayer2Refresh(siteId, lookbackHours)
    return NextResponse.json({
      status: "queued",
      site_id: siteId,
      ...run,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
