import Link from "next/link"
import type { ReactNode } from "react"
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Mail,
  Radio,
  Send,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { PreparedOnboardingEmail } from "@/lib/onboarding-email"
import { cn } from "@/lib/utils"

function timeAgo(value: string | null) {
  if (!value) return "No data"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function Surface({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]", className)}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const prepared = status === "prepared"
  return (
    <Badge
      variant="outline"
      className={cn(prepared ? "border-blue-100 bg-blue-50 text-blue-700" : "border-emerald-100 bg-emerald-50 text-emerald-700")}
    >
      {prepared ? <Inbox className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
      {prepared ? "Prepared" : status}
    </Badge>
  )
}

export function EmailsPage({ emails }: { emails: PreparedOnboardingEmail[] }) {
  const latest = emails[0]
  const preparedCount = emails.filter((email) => email.status === "prepared").length

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">Email Outbox</div>
              <div className="text-xs text-slate-500">Prepared onboarding emails before real SMTP is connected</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <Link href="/start">
                <Radio className="h-4 w-4" />
                Start
              </Link>
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/setup">
                Setup
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 md:px-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-5">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Total emails</span>
                <Inbox className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{emails.length}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Prepared</span>
                <Send className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{preparedCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Provider</span>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">Mock</div>
            </div>
          </section>

          <Surface title="Prepared Emails" description="Each new /start provisioning stores one onboarding message here.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="py-3 pr-4">Recipient</th>
                    <th className="py-3 pr-4">Site</th>
                    <th className="py-3 pr-4">Subject</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Created</th>
                    <th className="py-3 pr-4">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((email) => (
                    <tr key={email.email_id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-950">{email.to_email}</div>
                        <div className="text-xs text-slate-500">{email.provider}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{email.site_id}</td>
                      <td className="max-w-[320px] py-3 pr-4">
                        <div className="truncate font-medium text-slate-950">{email.subject}</div>
                        <div className="truncate text-xs text-slate-500">{email.preview_text}</div>
                      </td>
                      <td className="py-3 pr-4"><StatusBadge status={email.status} /></td>
                      <td className="py-3 pr-4 text-xs text-slate-500">{timeAgo(email.created_at)}</td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-2">
                          <Button asChild size="sm" variant="outline" className="border-slate-200 bg-white text-slate-700">
                            <Link href={email.connect_url}>Connect</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline" className="border-slate-200 bg-white text-slate-700">
                            <Link href={email.dashboard_url}>Dashboard</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!emails.length ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                        No onboarding emails prepared yet. Create a store from /start.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Surface>
        </div>

        <aside className="space-y-5">
          <Surface title="Latest Email Preview" description="This is what would be sent when SMTP is connected.">
            {latest ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">To</div>
                  <div className="mt-1 text-sm font-medium text-slate-950">{latest.to_email}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Subject</div>
                  <div className="mt-1 text-sm font-medium text-slate-950">{latest.subject}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{latest.body_text}</pre>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <Link href={latest.connect_url}>
                      Open Connect
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                    <Link href={latest.dashboard_url}>Dashboard</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                No preview yet.
              </div>
            )}
          </Surface>

          <Surface title="Security Choice" description="Why the server secret is not stored in the email body.">
            <div className="text-sm leading-6 text-slate-600">
              The email includes the public write key because browser trackers need it. The server secret remains a one-time value shown on the access page only, so leaked email history cannot expose private server-side credentials.
            </div>
          </Surface>
        </aside>
      </main>
    </div>
  )
}
