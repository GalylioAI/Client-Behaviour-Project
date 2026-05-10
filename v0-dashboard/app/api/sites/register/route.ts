import { createHash, randomBytes } from "node:crypto"

import { NextResponse } from "next/server"

import { ensureAuthSchema, findUserByEmail, getSessionFromRequest, hashPassword, setSessionCookie } from "@/lib/auth"
import { clickhouseCommand, clickhouseQuery, sqlArray, sqlString } from "@/lib/clickhouse"
import { ensureControlPlaneSchema } from "@/lib/control-plane"
import { prepareOnboardingEmail } from "@/lib/onboarding-email"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_PLATFORMS = new Set(["wordpress", "prestashop"])

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
}

function normalizeDomain(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
    return parsed.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase()
  }
}

function normalizeOrigin(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
    return `${parsed.protocol}//${parsed.host}`.toLowerCase().replace(/\/$/, "")
  } catch {
    return trimmed.toLowerCase().replace(/\/$/, "")
  }
}

function defaultOrigins(domain: string) {
  return [`https://${domain}`, `https://www.${domain}`]
}

function parseOrigins(raw: unknown, domain: string) {
  const values =
    typeof raw === "string"
      ? raw
          .split(/[\n,]+/)
          .map(normalizeOrigin)
          .filter(Boolean)
      : []

  const source = values.length ? values : defaultOrigins(domain)
  return Array.from(new Set(source.map(normalizeOrigin).filter(Boolean)))
}

function makeKey(prefix: "pk_live_" | "sk_live_") {
  return `${prefix}${randomBytes(24).toString("hex")}`
}

function keyHash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

async function insertStatement(sql: string) {
  await clickhouseCommand(sql)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const session = getSessionFromRequest(request)
    let tenantName = String(body.tenant_name || "").trim()
    const adminEmail = String(session?.email || body.admin_email || "").trim().toLowerCase()
    const domain = normalizeDomain(String(body.domain || ""))
    const platform = String(body.platform || "").trim().toLowerCase()
    const plan = String(body.plan || "starter").trim().toLowerCase() || "starter"
    const timezone = String(body.timezone || "Africa/Tunis").trim() || "Africa/Tunis"
    const tenantId = String(session?.tenant_id || body.tenant_id || `tenant_${slug(tenantName || domain)}`).trim()
    const siteId = String(body.site_id || slug(domain)).trim()
    const allowedOrigins = parseOrigins(body.allowed_origins, domain)
    const password = String(body.password || "")

    if (!adminEmail || !adminEmail.includes("@")) {
      return NextResponse.json({ error: "A valid admin email is required." }, { status: 400 })
    }
    if (!domain) {
      return NextResponse.json({ error: "Website domain is required." }, { status: 400 })
    }
    if (!siteId) {
      return NextResponse.json({ error: "Site ID could not be generated." }, { status: 400 })
    }
    if (!VALID_PLATFORMS.has(platform)) {
      return NextResponse.json({ error: "Platform must be wordpress or prestashop." }, { status: 400 })
    }
    if (!session && password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    await ensureControlPlaneSchema()
    await ensureAuthSchema()

    if (session && !tenantName) {
      const tenantRows = await clickhouseQuery<{ name: string }>(`
        SELECT argMax(name, updated_at) AS name
        FROM tracer.tenants
        WHERE tenant_id = ${sqlString(tenantId)}
        GROUP BY tenant_id
        LIMIT 1
      `)
      tenantName = String(tenantRows[0]?.name || "").trim()
    }

    if (!tenantName) {
      if (!session) {
        return NextResponse.json({ error: "Tenant name is required." }, { status: 400 })
      }
      tenantName = adminEmail.split("@")[0] || domain
    }

    if (!session) {
      const existingUser = await findUserByEmail(adminEmail)
      if (existingUser?.password_hash) {
        return NextResponse.json({ error: "An account already exists for this email. Please log in instead." }, { status: 409 })
      }
    }

    const existingSiteRows = await clickhouseQuery<{ rows: number }>(`
      SELECT count() AS rows
      FROM tracer.sites
      WHERE site_id = ${sqlString(siteId)}
    `)
    if (Number(existingSiteRows[0]?.rows || 0) > 0) {
      return NextResponse.json(
        { error: `Site ID "${siteId}" already exists. Use another site ID or open the existing site from the control plane.` },
        { status: 409 }
      )
    }

    const now = Date.now().toString(36)
    const publicKey = makeKey("pk_live_")
    const serverKey = makeKey("sk_live_")
    const userId = session?.user_id || `user_${slug(adminEmail)}`
    const publicKeyId = `key_${siteId}_public_${now}`
    const serverKeyId = `key_${siteId}_server_${now}`
    const passwordHash = session ? "" : hashPassword(password)

    await insertStatement(`
      INSERT INTO tracer.tenants
        (tenant_id, name, contact_email, plan, status, created_at, updated_at)
      VALUES
        (${sqlString(tenantId)}, ${sqlString(tenantName)}, ${sqlString(adminEmail)}, ${sqlString(plan)}, 'active', now64(3), now64(3))
    `)

    if (!session) {
      await insertStatement(`
        INSERT INTO tracer.tenant_users
          (user_id, tenant_id, email, full_name, role, status, password_hash, created_at, last_login_at, updated_at)
        VALUES
          (
            ${sqlString(userId)},
            ${sqlString(tenantId)},
            ${sqlString(adminEmail)},
            ${sqlString(tenantName)},
            'owner',
            'active',
            ${sqlString(passwordHash)},
            now64(3),
            now64(3),
            now64(3)
          )
      `)
    }

    await insertStatement(`
      INSERT INTO tracer.sites
        (site_id, tenant_id, domain, platform, allowed_origins, timezone, status, plan, created_at, updated_at)
      VALUES
        (
          ${sqlString(siteId)},
          ${sqlString(tenantId)},
          ${sqlString(domain)},
          ${sqlString(platform)},
          ${sqlArray(allowedOrigins)},
          ${sqlString(timezone)},
          'active',
          ${sqlString(plan)},
          now64(3),
          now64(3)
        )
    `)

    await insertStatement(`
      INSERT INTO tracer.site_keys
        (key_id, site_id, key_type, key_prefix, key_hash, status, created_at, revoked_at, updated_at)
      VALUES
        (
          ${sqlString(publicKeyId)},
          ${sqlString(siteId)},
          'public_write',
          ${sqlString(publicKey.slice(0, 16))},
          ${sqlString(keyHash(publicKey))},
          'active',
          now64(3),
          NULL,
          now64(3)
        ),
        (
          ${sqlString(serverKeyId)},
          ${sqlString(siteId)},
          'server_secret',
          ${sqlString(serverKey.slice(0, 16))},
          ${sqlString(keyHash(serverKey))},
          'active',
          now64(3),
          NULL,
          now64(3)
        )
    `)

    let emailPackage = null
    let emailWarning = ""
    try {
      emailPackage = await prepareOnboardingEmail({
        tenantId,
        siteId,
        tenantName,
        adminEmail,
        domain,
        platform,
        publicWriteKey: publicKey,
      })
    } catch (emailError) {
      emailWarning = emailError instanceof Error ? emailError.message : "Could not prepare onboarding email."
    }

    const response = NextResponse.json({
      tenant_id: tenantId,
      site_id: siteId,
      domain,
      platform,
      allowed_origins: allowedOrigins,
      public_write_key: publicKey,
      server_secret_key: serverKey,
      email_package: emailPackage,
      email_warning: emailWarning,
      note: "Raw keys are shown once. ClickHouse stores only SHA-256 hashes.",
    })
    setSessionCookie(response, {
      user_id: userId,
      tenant_id: tenantId,
      email: adminEmail,
      role: session?.role || "owner",
    })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
