import { NextResponse } from "next/server"

import { getSessionFromRequest } from "@/lib/auth"
import { answerCopilotQuestion, type CopilotMessage } from "@/lib/copilot"
import { loadInsights } from "@/lib/insights"
import { canAccessSite } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function normalizeMessages(value: unknown): CopilotMessage[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const role = "role" in item ? String(item.role) : ""
      const content = "content" in item ? String(item.content || "").trim() : ""
      if ((role !== "user" && role !== "assistant") || !content) return null
      return { role, content: content.slice(0, 2000) } satisfies CopilotMessage
    })
    .filter((item): item is CopilotMessage => Boolean(item))
    .slice(-10)
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const body = await request.json()
    const siteId = String(body.site_id || "").trim()
    const question = String(body.question || "").trim()
    const history = normalizeMessages(body.messages)

    if (!siteId) {
      return NextResponse.json({ error: "site_id is required." }, { status: 400 })
    }

    if (!question) {
      return NextResponse.json({ error: "question is required." }, { status: 400 })
    }

    const allowed = await canAccessSite(session.tenant_id, siteId)
    if (!allowed) {
      return NextResponse.json({ error: "You do not have access to this site." }, { status: 403 })
    }

    const insights = await loadInsights(siteId)
    const result = await answerCopilotQuestion({
      question,
      history,
      insights,
    })

    return NextResponse.json({
      site_id: siteId,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
