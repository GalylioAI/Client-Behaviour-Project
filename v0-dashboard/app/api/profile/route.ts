import { NextResponse } from "next/server"

import { findUserByEmail, getSessionFromRequest, updateUserProfile } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function profilePayload(user: Awaited<ReturnType<typeof findUserByEmail>>) {
  if (!user) return null
  return {
    user_id: user.user_id,
    tenant_id: user.tenant_id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    status: user.status,
    auth_provider: user.auth_provider || "password",
    google_connected: Boolean(user.google_sub),
    avatar_url: user.avatar_url || "",
  }
}

export async function GET(request: Request) {
  const session = getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  const user = await findUserByEmail(session.email)
  if (!user || user.user_id !== session.user_id || user.tenant_id !== session.tenant_id) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 })
  }

  return NextResponse.json({ profile: profilePayload(user) })
}

export async function PATCH(request: Request) {
  const session = getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const fullName = String(body.full_name || "").trim()
  const avatarUrl = String(body.avatar_url || "").trim()

  if (!fullName) {
    return NextResponse.json({ error: "Display name is required." }, { status: 400 })
  }

  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
    return NextResponse.json({ error: "Avatar URL must start with http:// or https://." }, { status: 400 })
  }

  const user = await findUserByEmail(session.email)
  if (!user || user.user_id !== session.user_id || user.tenant_id !== session.tenant_id) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 })
  }

  const updated = await updateUserProfile(user, { fullName, avatarUrl })
  return NextResponse.json({ profile: profilePayload(updated) })
}
