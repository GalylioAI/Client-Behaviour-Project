"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { Activity, ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("grid h-10 w-10 place-items-center rounded-md bg-blue-600 text-white shadow-sm", className)}>
      <Activity className="h-5 w-5" />
    </div>
  )
}

export function ForgotPasswordPage() {
  const { t } = useI18n()
  const [step, setStep] = useState<"request" | "reset">("request")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Could not send reset code.")

      setMessage(
        payload.dev_code
          ? `${payload.message} Dev code: ${payload.dev_code}`
          : payload.message || "Check your email for the verification code."
      )
      setStep("reset")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send reset code.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Could not reset password.")
      window.location.href = payload.next || "/app"
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reset password.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="grid min-h-screen lg:grid-cols-[minmax(0,0.92fr)_minmax(500px,1.08fr)]">
        <section className="flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <LogoMark className="h-9 w-9" />
              <div>
                <div className="text-sm font-semibold text-slate-950">BehaviourAI</div>
                <div className="text-xs text-slate-500">{t("auth.recovery")}</div>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher compact />
              <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                <Link href="/login">
                  <ArrowLeft className="h-4 w-4" />
                  {t("common.login")}
                </Link>
              </Button>
            </div>
          </header>

          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[420px]">
              <div className="mb-8">
                <LogoMark />
                <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">{t("auth.resetTitle")}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {t("auth.resetSubtitle")}
                </p>
              </div>

              {step === "request" ? (
                <form className="space-y-5" onSubmit={requestCode}>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">{t("auth.email")}</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="owner@example.tn"
                      disabled={isSubmitting}
                      className="h-11 border-slate-200 bg-white"
                    />
                  </div>

                  {error ? <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div> : null}

                  <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-blue-600 hover:bg-blue-700">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    {t("auth.sendCode")}
                  </Button>
                </form>
              ) : (
                <form className="space-y-5" onSubmit={resetPassword}>
                  {message ? <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-700">{message}</div> : null}

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">{t("auth.verificationCode")}</Label>
                    <Input
                      inputMode="numeric"
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit code"
                      disabled={isSubmitting}
                      className="h-11 border-slate-200 bg-white text-center text-lg font-semibold tracking-[0.35em]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">{t("auth.newPassword")}</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      disabled={isSubmitting}
                      className="h-11 border-slate-200 bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">{t("auth.confirmPassword")}</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat the new password"
                      disabled={isSubmitting}
                      className="h-11 border-slate-200 bg-white"
                    />
                  </div>

                  {error ? <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div> : null}

                  <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-blue-600 hover:bg-blue-700">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    {t("auth.resetPassword")}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="hidden min-h-screen bg-[#edf5ff] p-5 lg:block">
          <div className="flex h-full flex-col justify-between rounded-lg border border-blue-100 bg-[linear-gradient(135deg,#f8fbff_0%,#dbeafe_48%,#e0f2fe_100%)] p-8 shadow-[0_20px_80px_rgba(23,105,232,0.16)]">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-medium text-blue-700">
                <ShieldCheck className="h-4 w-4" />
                Protected recovery
              </div>
              <h2 className="mt-8 text-4xl font-semibold tracking-tight text-slate-950">
                Recover access without exposing tenant data.
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Reset codes are hashed, expire quickly, and are stored separately from account sessions.
              </p>
            </div>

            <div className="grid gap-4">
              {["Short-lived verification code", "Password hash replaced after code validation", "Automatic login after successful reset"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md border border-white/70 bg-white/75 p-4 text-sm font-medium text-slate-700 shadow-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
