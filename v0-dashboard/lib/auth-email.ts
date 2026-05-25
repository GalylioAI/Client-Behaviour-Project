import net from "node:net"
import tls from "node:tls"

import { clickhouseCommand, clickhouseInsertJson } from "@/lib/clickhouse"

type SmtpSocket = net.Socket | tls.TLSSocket

const FROM_EMAIL = process.env.AUTH_EMAIL_FROM || process.env.SMTP_FROM || "BehaviourAI <no-reply@behaviourai.local>"

export async function ensureAuthEmailOutboxSchema() {
  await clickhouseCommand(`
    CREATE TABLE IF NOT EXISTS tracer.auth_email_outbox
    (
      email_id     String,
      to_email     String,
      subject      String,
      body_text    String,
      body_html    String,
      status       LowCardinality(String) DEFAULT 'prepared',
      provider     LowCardinality(String) DEFAULT 'mock',
      error        String DEFAULT '',
      created_at   DateTime64(3, 'UTC') DEFAULT now64(3),
      sent_at      Nullable(DateTime64(3, 'UTC')),
      updated_at   DateTime64(3, 'UTC') DEFAULT now64(3)
    )
    ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (to_email, email_id)
  `)
}

function emailId(toEmail: string) {
  return `auth_email_${toEmail.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 48)}_${Date.now().toString(36)}`
}

function encodeBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64")
}

function parseAddress(value: string) {
  const match = value.match(/<([^>]+)>/)
  return (match?.[1] || value).trim()
}

function readResponse(socket: SmtpSocket) {
  return new Promise<string>((resolve, reject) => {
    let data = ""
    const onData = (chunk: Buffer) => {
      data += chunk.toString("utf8")
      const lines = data.split(/\r?\n/).filter(Boolean)
      const last = lines[lines.length - 1] || ""
      if (/^\d{3}\s/.test(last)) {
        socket.off("data", onData)
        socket.off("error", onError)
        resolve(data)
      }
    }
    const onError = (error: Error) => {
      socket.off("data", onData)
      socket.off("error", onError)
      reject(error)
    }
    socket.on("data", onData)
    socket.on("error", onError)
  })
}

async function command(socket: SmtpSocket, line: string, expected: number[]) {
  socket.write(`${line}\r\n`)
  const response = await readResponse(socket)
  const code = Number(response.slice(0, 3))
  if (!expected.includes(code)) {
    throw new Error(`SMTP command failed: ${response.trim()}`)
  }
  return response
}

async function sendViaSmtp(input: { to: string; subject: string; text: string; html: string }) {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = process.env.SMTP_SECURE === "true" || port === 465

  if (!host) {
    return { sent: false, provider: "mock", error: "SMTP_HOST is not configured." }
  }

  let socket: SmtpSocket = secure
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port })

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve)
    socket.once("error", reject)
  })
  await readResponse(socket)
  await command(socket, `EHLO ${process.env.SMTP_HELO || "behaviourai.local"}`, [250])

  if (!secure && process.env.SMTP_STARTTLS !== "false") {
    await command(socket, "STARTTLS", [220])
    socket = tls.connect({ socket, servername: host })
    await command(socket, `EHLO ${process.env.SMTP_HELO || "behaviourai.local"}`, [250])
  }

  if (user && password) {
    await command(socket, "AUTH LOGIN", [334])
    await command(socket, encodeBase64(user), [334])
    await command(socket, encodeBase64(password), [235])
  }

  const boundary = `b_${Date.now().toString(36)}`
  const message = [
    `From: ${FROM_EMAIL}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    input.html,
    "",
    `--${boundary}--`,
    ".",
  ].join("\r\n")

  await command(socket, `MAIL FROM:<${parseAddress(FROM_EMAIL)}>`, [250])
  await command(socket, `RCPT TO:<${input.to}>`, [250, 251])
  await command(socket, "DATA", [354])
  await command(socket, message, [250])
  await command(socket, "QUIT", [221])
  socket.end()

  return { sent: true, provider: "smtp", error: "" }
}

export async function sendPasswordResetEmail(input: { to: string; code: string }) {
  await ensureAuthEmailOutboxSchema()

  const subject = "Your BehaviourAI password reset code"
  const text = [
    "Hi,",
    "",
    "Use this verification code to reset your BehaviourAI password:",
    "",
    input.code,
    "",
    "The code expires in 15 minutes. If you did not request this reset, you can ignore this email.",
    "",
    "BehaviourAI",
  ].join("\n")
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>Hi,</p>
      <p>Use this verification code to reset your BehaviourAI password:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${input.code}</p>
      <p>The code expires in 15 minutes. If you did not request this reset, you can ignore this email.</p>
      <p>BehaviourAI</p>
    </div>
  `.trim()

  const result = await sendViaSmtp({ to: input.to, subject, text, html }).catch((error) => ({
    sent: false,
    provider: "smtp",
    error: error instanceof Error ? error.message : "SMTP send failed.",
  }))

  await clickhouseInsertJson("tracer.auth_email_outbox", {
    email_id: emailId(input.to),
    to_email: input.to.toLowerCase(),
    subject,
    body_text: text,
    body_html: html,
    status: result.sent ? "sent" : "prepared",
    provider: result.provider,
    error: result.error,
    sent_at: result.sent ? new Date().toISOString().slice(0, 19).replace("T", " ") : null,
  })

  return result
}
