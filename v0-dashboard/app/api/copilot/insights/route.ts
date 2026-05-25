import { NextResponse } from "next/server"

import { getSessionFromRequest } from "@/lib/auth"
import { generateDashboardAiInsights } from "@/lib/copilot"
import { loadInsights } from "@/lib/insights"
import { canAccessSite } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const siteId = String(body.site_id || "").trim()

    if (!siteId) {
      return NextResponse.json({ error: "site_id is required." }, { status: 400 })
    }

    const allowed = await canAccessSite(session.tenant_id, siteId)
    if (!allowed) {
      return NextResponse.json({ error: "You do not have access to this site." }, { status: 403 })
    }

    const insights = await loadInsights(siteId)
    const result = await generateDashboardAiInsights({ insights })

    return NextResponse.json({
      site_id: siteId,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
