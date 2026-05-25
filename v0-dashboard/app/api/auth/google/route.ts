import { NextResponse } from "next/server"

import { createOAuthState, oauthStateCookieOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function appBaseUrl(request: Request) {
  const configured = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, "")
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") || "http"
  if (host) return `${proto}://${host}`
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", appBaseUrl(request)))
  }

  const url = new URL(request.url)
  const rawNext = url.searchParams.get("next") || "/app"
  const state = createOAuthState(rawNext)
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", `${appBaseUrl(request)}/api/auth/google/callback`)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", "openid email profile")
  authUrl.searchParams.set("state", state)
  authUrl.searchParams.set("prompt", "select_account")

  const response = NextResponse.redirect(authUrl)
  response.cookies.set("behaviourai_oauth_state", state, oauthStateCookieOptions())
  return response
}
