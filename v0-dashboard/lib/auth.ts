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
  auth_provider?: string
  google_sub?: string
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
      auth_provider LowCardinality(String) DEFAULT 'password',
      google_sub    String DEFAULT '',
      created_at    DateTime64(3, 'UTC') DEFAULT now64(3),
      last_login_at Nullable(DateTime64(3, 'UTC')),
      updated_at    DateTime64(3, 'UTC') DEFAULT now64(3)
    )
    ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (tenant_id, user_id)
  `)
  await clickhouseCommand("ALTER TABLE tracer.tenant_users ADD COLUMN IF NOT EXISTS password_hash String DEFAULT ''")
  await clickhouseCommand("ALTER TABLE tracer.tenant_users ADD COLUMN IF NOT EXISTS auth_provider LowCardinality(String) DEFAULT 'password'")
  await clickhouseCommand("ALTER TABLE tracer.tenant_users ADD COLUMN IF NOT EXISTS google_sub String DEFAULT ''")
  await clickhouseCommand("ALTER TABLE tracer.tenant_users ADD COLUMN IF NOT EXISTS last_login_at Nullable(DateTime64(3, 'UTC'))")

  await clickhouseCommand(`
    CREATE TABLE IF NOT EXISTS tracer.auth_password_reset_codes
    (
      reset_id     String,
      email        String,
      code_hash    String,
      status       LowCardinality(String) DEFAULT 'pending',
      expires_at   DateTime64(3, 'UTC'),
      created_at   DateTime64(3, 'UTC') DEFAULT now64(3),
      used_at      Nullable(DateTime64(3, 'UTC')),
      updated_at   DateTime64(3, 'UTC') DEFAULT now64(3)
    )
    ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (email, reset_id)
  `)
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

export function hashAuthCode(email: string, code: string) {
  return createHmac("sha256", AUTH_SECRET).update(`${email.toLowerCase()}:${code}`).digest("hex")
}

export function createResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function slugAuthValue(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56)
}

export function createOAuthState(nextPath = "/app") {
  const payload = {
    nonce: randomBytes(18).toString("base64url"),
    next: nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/app",
    exp: Date.now() + 10 * 60 * 1000,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${body}.${sign(body)}`
}

export function verifyOAuthState(state: string | null) {
  if (!state || !state.includes(".")) return null
  const [body, signature] = state.split(".")
  if (!body || !signature || sign(body) !== signature) return null

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      nonce?: string
      next?: string
      exp?: number
    }
    if (!payload.nonce || !payload.exp || payload.exp < Date.now()) return null
    return {
      nonce: payload.nonce,
      next: payload.next?.startsWith("/") && !payload.next.startsWith("//") ? payload.next : "/app",
    }
  } catch {
    return null
  }
}

export function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    path: "/",
    maxAge: 10 * 60,
  }
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
      password_hash,
      auth_provider,
      google_sub
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
        auth_provider: str(row.auth_provider, "password"),
        google_sub: str(row.google_sub),
      }
    : null
}

export async function findUserByGoogleSub(googleSub: string): Promise<AuthUser | null> {
  await ensureAuthSchema()

  const rows = await clickhouseQuery(`
    SELECT
      user_id,
      tenant_id,
      email,
      full_name,
      role,
      status,
      password_hash,
      auth_provider,
      google_sub
    FROM tracer.tenant_users FINAL
    WHERE google_sub = ${sqlString(googleSub)}
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
        auth_provider: str(row.auth_provider, "google"),
        google_sub: str(row.google_sub),
      }
    : null
}

export async function createOrUpdateGoogleUser(input: {
  googleSub: string
  email: string
  fullName: string
}): Promise<AuthUser> {
  await ensureAuthSchema()

  const email = input.email.trim().toLowerCase()
  const existingBySub = await findUserByGoogleSub(input.googleSub)
  const existingByEmail = existingBySub || (await findUserByEmail(email))
  const tenantId = existingByEmail?.tenant_id || `tenant_${slugAuthValue(email.split("@")[1] || email)}`
  const userId = existingByEmail?.user_id || `user_${slugAuthValue(email)}`
  const fullName = input.fullName.trim() || existingByEmail?.full_name || email.split("@")[0] || "Owner"

  await clickhouseCommand(`
    INSERT INTO tracer.tenant_users
      (user_id, tenant_id, email, full_name, role, status, password_hash, auth_provider, google_sub, created_at, last_login_at, updated_at)
    VALUES
      (
        ${sqlString(userId)},
        ${sqlString(tenantId)},
        ${sqlString(email)},
        ${sqlString(fullName)},
        ${sqlString(existingByEmail?.role || "owner")},
        'active',
        ${sqlString(existingByEmail?.password_hash || "")},
        'google',
        ${sqlString(input.googleSub)},
        now64(3),
        now64(3),
        now64(3)
      )
  `)

  return {
    user_id: userId,
    tenant_id: tenantId,
    email,
    full_name: fullName,
    role: existingByEmail?.role || "owner",
    status: "active",
    password_hash: existingByEmail?.password_hash || "",
    auth_provider: "google",
    google_sub: input.googleSub,
  }
}

export async function storePasswordResetCode(email: string, code: string) {
  await ensureAuthSchema()
  const resetId = `reset_${slugAuthValue(email)}_${Date.now().toString(36)}`
  await clickhouseCommand(`
    INSERT INTO tracer.auth_password_reset_codes
      (reset_id, email, code_hash, status, expires_at, created_at, used_at, updated_at)
    VALUES
      (
        ${sqlString(resetId)},
        ${sqlString(email.toLowerCase())},
        ${sqlString(hashAuthCode(email, code))},
        'pending',
        now64(3) + INTERVAL 15 MINUTE,
        now64(3),
        NULL,
        now64(3)
      )
  `)
  return resetId
}

export async function consumePasswordResetCode(email: string, code: string) {
  await ensureAuthSchema()
  const rows = await clickhouseQuery<{ reset_id: string; code_hash: string }>(`
    SELECT reset_id, code_hash
    FROM tracer.auth_password_reset_codes FINAL
    WHERE email = ${sqlString(email.toLowerCase())}
      AND status = 'pending'
      AND expires_at > now64(3)
    ORDER BY created_at DESC
    LIMIT 1
  `)

  const row = rows[0]
  if (!row || str(row.code_hash) !== hashAuthCode(email, code)) {
    return false
  }

  await clickhouseCommand(`
    INSERT INTO tracer.auth_password_reset_codes
      (reset_id, email, code_hash, status, expires_at, created_at, used_at, updated_at)
    VALUES
      (
        ${sqlString(str(row.reset_id))},
        ${sqlString(email.toLowerCase())},
        ${sqlString(str(row.code_hash))},
        'used',
        now64(3),
        now64(3),
        now64(3),
        now64(3)
      )
  `)
  return true
}

export async function updateUserPassword(user: AuthUser, password: string) {
  await ensureAuthSchema()
  await clickhouseCommand(`
    INSERT INTO tracer.tenant_users
      (user_id, tenant_id, email, full_name, role, status, password_hash, auth_provider, google_sub, created_at, last_login_at, updated_at)
    VALUES
      (
        ${sqlString(user.user_id)},
        ${sqlString(user.tenant_id)},
        ${sqlString(user.email)},
        ${sqlString(user.full_name)},
        ${sqlString(user.role)},
        ${sqlString(user.status)},
        ${sqlString(hashPassword(password))},
        ${sqlString(user.auth_provider || "password")},
        ${sqlString(user.google_sub || "")},
        now64(3),
        ${user.status === "active" ? "now64(3)" : "NULL"},
        now64(3)
      )
  `)
}

export async function markLogin(user: AuthUser) {
  await clickhouseCommand(`
    INSERT INTO tracer.tenant_users
      (user_id, tenant_id, email, full_name, role, status, password_hash, auth_provider, google_sub, created_at, last_login_at, updated_at)
    VALUES
      (
        ${sqlString(user.user_id)},
        ${sqlString(user.tenant_id)},
        ${sqlString(user.email)},
        ${sqlString(user.full_name)},
        ${sqlString(user.role)},
        ${sqlString(user.status)},
        ${sqlString(user.password_hash)},
        ${sqlString(user.auth_provider || "password")},
        ${sqlString(user.google_sub || "")},
        now64(3),
        now64(3),
        now64(3)
      )
  `)
}
