import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"

import { clickhouseCommand, clickhouseQuery, sqlString, str } from "@/lib/clickhouse"

export const AUTH_COOKIE_NAME = "behaviourai_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-behaviourai-change-this-secret"

export interface AuthSession {
  user_id: string
  tenant_id: string
  email: string
  role: string
  exp: number
}

export interface AuthUser {
  user_id: string
  tenant_id: string
  email: string
  full_name: string
  role: string
  status: string
  password_hash: string
}

export async function ensureAuthSchema() {
  await clickhouseCommand(`
    CREATE TABLE IF NOT EXISTS tracer.tenant_users
    (
      user_id       String,
      tenant_id     String,
      email         String,
      full_name     String,
      role          LowCardinality(String) DEFAULT 'owner',
      status        LowCardinality(String) DEFAULT 'active',
      password_hash String DEFAULT '',
      created_at    DateTime64(3, 'UTC') DEFAULT now64(3),
      last_login_at Nullable(DateTime64(3, 'UTC')),
      updated_at    DateTime64(3, 'UTC') DEFAULT now64(3)
    )
    ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (tenant_id, user_id)
  `)
  await clickhouseCommand("ALTER TABLE tracer.tenant_users ADD COLUMN IF NOT EXISTS password_hash String DEFAULT ''")
  await clickhouseCommand("ALTER TABLE tracer.tenant_users ADD COLUMN IF NOT EXISTS last_login_at Nullable(DateTime64(3, 'UTC'))")
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$")
  if (scheme !== "scrypt" || !salt || !hash) return false

  const expected = Buffer.from(hash, "hex")
  const actual = scryptSync(password, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function sign(value: string) {
  return createHmac("sha256", AUTH_SECRET).update(value).digest("base64url")
}

function encodeSession(payload: Omit<AuthSession, "exp">) {
  const session: AuthSession = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(session)).toString("base64url")
  return `${body}.${sign(body)}`
}

function decodeSession(token: string | undefined): AuthSession | null {
  if (!token || !token.includes(".")) return null
  const [body, signature] = token.split(".")
  if (!body || !signature || sign(body) !== signature) return null

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AuthSession
    if (!payload.user_id || !payload.tenant_id || !payload.email || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  }
}

export function setSessionCookie(response: NextResponse, user: Omit<AuthSession, "exp">) {
  response.cookies.set(AUTH_COOKIE_NAME, encodeSession(user), cookieOptions())
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...cookieOptions(),
    maxAge: 0,
  })
}

export async function getSession() {
  const store = await cookies()
  return decodeSession(store.get(AUTH_COOKIE_NAME)?.value)
}

export function getSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") || ""
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(AUTH_COOKIE_NAME.length + 1)
  return decodeSession(token)
}

export async function requireSession(next = "/") {
  const session = await getSession()
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }
  return session
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  await ensureAuthSchema()

  const rows = await clickhouseQuery(`
    SELECT
      user_id,
      tenant_id,
      email,
      full_name,
      role,
      status,
      password_hash
    FROM tracer.tenant_users FINAL
    WHERE lower(email) = ${sqlString(email.toLowerCase())}
      AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 1
  `)

  const row = rows[0]
  return row
    ? {
        user_id: str(row.user_id),
        tenant_id: str(row.tenant_id),
        email: str(row.email).toLowerCase(),
        full_name: str(row.full_name),
        role: str(row.role, "owner"),
        status: str(row.status, "active"),
        password_hash: str(row.password_hash),
      }
    : null
}

export async function markLogin(user: AuthUser) {
  await clickhouseCommand(`
    INSERT INTO tracer.tenant_users
      (user_id, tenant_id, email, full_name, role, status, password_hash, created_at, last_login_at, updated_at)
    VALUES
      (
        ${sqlString(user.user_id)},
        ${sqlString(user.tenant_id)},
        ${sqlString(user.email)},
        ${sqlString(user.full_name)},
        ${sqlString(user.role)},
        ${sqlString(user.status)},
        ${sqlString(user.password_hash)},
        now64(3),
        now64(3),
        now64(3)
      )
  `)
}
