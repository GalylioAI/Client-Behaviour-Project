import { NextResponse } from "next/server"

import { getSessionFromRequest } from "@/lib/auth"
import { loadAutomationSettings, saveAutomationSettings } from "@/lib/automation-settings"
import { canAccessSite } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function normalizeSiteId(value: unknown) {
  return String(value || "").trim()
}

export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const url = new URL(request.url)
    const siteId = normalizeSiteId(url.searchParams.get("site_id"))
    if (!siteId) {
      return NextResponse.json({ error: "site_id is required." }, { status: 400 })
    }

    if (!(await canAccessSite(session.tenant_id, siteId))) {
      return NextResponse.json({ error: "Site not found for this tenant." }, { status: 404 })
    }

    const settings = await loadAutomationSettings(siteId, session.tenant_id)
    return NextResponse.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const body = await request.json()
    const siteId = normalizeSiteId(body.site_id)
    const recommendationIntensity = Number(body.recommendation_intensity)

    if (!siteId) {
      return NextResponse.json({ error: "site_id is required." }, { status: 400 })
    }

    if (!Number.isFinite(recommendationIntensity) || recommendationIntensity < 1 || recommendationIntensity > 10) {
      return NextResponse.json({ error: "recommendation_intensity must be between 1 and 10." }, { status: 400 })
    }

    const settings = await saveAutomationSettings({
      siteId,
      tenantId: session.tenant_id,
      recommendationIntensity,
    })

    return NextResponse.json({
      settings,
      note: "Automation intensity saved. Sending remains draft-only until provider, consent, and approval rules are enabled.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const status = message.includes("was not found") ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
