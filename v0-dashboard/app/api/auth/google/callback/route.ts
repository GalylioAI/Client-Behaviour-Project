import { NextResponse } from "next/server"

import {
  createOrUpdateGoogleUser,
  oauthStateCookieOptions,
  setSessionCookie,
  verifyOAuthState,
} from "@/lib/auth"

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

type GoogleUserInfo = {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}

async function exchangeCode(request: Request, code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.")
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${appBaseUrl(request)}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error("Google OAuth token exchange failed", {
      status: response.status,
      detail,
      redirect_uri: `${appBaseUrl(request)}/api/auth/google/callback`,
    })
    throw new Error(`Google token exchange failed: ${response.status}`)
  }
  return response.json() as Promise<{ access_token: string }>
}

async function loadGoogleUser(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error("Could not load Google profile.")
  }
  return response.json() as Promise<GoogleUserInfo>
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const savedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("behaviourai_oauth_state="))
    ?.slice("behaviourai_oauth_state=".length)
  const savedStateValue = savedState ? decodeURIComponent(savedState) : ""

  const parsedState = verifyOAuthState(state)
  if (!code || !state || !savedStateValue || savedStateValue !== state || !parsedState) {
    return NextResponse.redirect(new URL("/login?error=google_state", appBaseUrl(request)))
  }

  try {
    const token = await exchangeCode(request, code)
    const profile = await loadGoogleUser(token.access_token)

    if (!profile.sub || !profile.email || profile.email_verified === false) {
      throw new Error("Google account email is not verified.")
    }

    const user = await createOrUpdateGoogleUser({
      googleSub: profile.sub,
      email: profile.email,
      fullName: profile.name || "",
      avatarUrl: profile.picture || "",
    })

    const response = NextResponse.redirect(new URL(parsedState.next || "/app", appBaseUrl(request)))
    response.cookies.set("behaviourai_oauth_state", "", { ...oauthStateCookieOptions(), maxAge: 0 })
    setSessionCookie(response, {
      user_id: user.user_id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
    })
    return response
  } catch (error) {
    const message = error instanceof Error ? encodeURIComponent(error.message) : "google_failed"
    return NextResponse.redirect(new URL(`/login?error=${message}`, appBaseUrl(request)))
  }
}
