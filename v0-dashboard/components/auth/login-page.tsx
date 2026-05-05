"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, LockKeyhole, Radio } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginPage({ nextPath = "/" }: { nextPath?: string }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Could not log in.")
      }

      window.location.href = nextPath || "/"
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log in.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">BehaviourAI</div>
              <div className="text-xs text-slate-500">Secure tenant access</div>
            </div>
          </div>
          <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
            <Link href="/start">
              Create Workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1040px] gap-5 px-4 py-8 md:px-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-700">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Log In</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use the account created when the workspace was provisioned.
            </p>
          </div>

          <form className="space-y-4 p-5" onSubmit={submit}>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@example.tn"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                disabled={isSubmitting}
              />
            </div>

            {error ? <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div> : null}

            <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              Continue
            </Button>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <h2 className="text-sm font-semibold text-slate-950">What This Protects</h2>
          <div className="mt-4 grid gap-3">
            {[
              ["Dashboard", "Only sites inside your tenant are visible."],
              ["API keys", "A customer can rotate keys only for their own website."],
              ["Debug logs", "Rejected events and audit rows stay tenant-scoped."],
              ["Email outbox", "Prepared onboarding emails are filtered by tenant."],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-950">{title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
