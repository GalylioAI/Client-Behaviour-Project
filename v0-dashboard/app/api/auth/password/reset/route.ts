import { NextResponse } from "next/server"

import { consumePasswordResetCode, findUserByEmail, setSessionCookie, updateUserPassword } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()
    const code = String(body.code || "").replace(/\D/g, "")
    const password = String(body.password || "")

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
    }
    if (code.length !== 6) {
      return NextResponse.json({ error: "Enter the 6-digit verification code." }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: "Invalid or expired verification code." }, { status: 400 })
    }

    const valid = await consumePasswordResetCode(email, code)
    if (!valid) {
      return NextResponse.json({ error: "Invalid or expired verification code." }, { status: 400 })
    }

    await updateUserPassword(user, password)

    const response = NextResponse.json({ ok: true, next: "/app" })
    setSessionCookie(response, {
      user_id: user.user_id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
    })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reset password."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
