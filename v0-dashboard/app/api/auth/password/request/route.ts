import { NextResponse } from "next/server"

import { sendPasswordResetEmail } from "@/lib/auth-email"
import { createResetCode, findUserByEmail, storePasswordResetCode } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json({
        ok: true,
        message: "If this email exists, a reset code has been sent.",
      })
    }

    const code = createResetCode()
    await storePasswordResetCode(email, code)
    const result = await sendPasswordResetEmail({ to: email, code })

    return NextResponse.json({
      ok: true,
      message: result.sent
        ? "A reset code has been sent to your email."
        : "Reset code prepared, but SMTP is not configured yet.",
      email_sent: result.sent,
      provider: result.provider,
      dev_code: process.env.AUTH_EMAIL_DEBUG_CODE === "true" || process.env.NODE_ENV !== "production" ? code : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not request password reset."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
