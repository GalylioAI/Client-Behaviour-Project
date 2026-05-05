import { NextResponse } from "next/server"

import { findUserByEmail, markLogin, setSessionCookie, verifyPassword } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")

    if (!email || !email.includes("@") || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
    }

    const user = await findUserByEmail(email)
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }

    await markLogin(user)

    const response = NextResponse.json({
      user: {
        user_id: user.user_id,
        tenant_id: user.tenant_id,
        email: user.email,
        role: user.role,
      },
    })
    setSessionCookie(response, {
      user_id: user.user_id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
    })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
