import { NextResponse } from "next/server"

import { rotateSiteKey, type ManagedKeyType } from "@/lib/site-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_KEY_TYPES = new Set(["public_write", "server_secret"])

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const siteId = String(body.site_id || "").trim()
    const keyType = String(body.key_type || "public_write").trim()

    if (!siteId) {
      return NextResponse.json({ error: "site_id is required." }, { status: 400 })
    }

    if (!VALID_KEY_TYPES.has(keyType)) {
      return NextResponse.json({ error: "key_type must be public_write or server_secret." }, { status: 400 })
    }

    const result = await rotateSiteKey(siteId, keyType as ManagedKeyType)
    return NextResponse.json({
      ...result,
      note: "Raw key is shown once. ClickHouse stores only the SHA-256 hash.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
