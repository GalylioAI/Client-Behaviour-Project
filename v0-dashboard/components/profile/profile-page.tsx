"use client"

import Link from "next/link"
import { useState, type FormEvent, type ReactNode } from "react"
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { LanguageSwitcher } from "@/components/language-switcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type ProfileData = {
  user_id: string
  tenant_id: string
  email: string
  full_name: string
  role: string
  status: string
  auth_provider: string
  google_connected: boolean
  avatar_url: string
}

function initials(value: string) {
  const clean = value.trim()
  if (!clean) return "U"
  return clean
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || clean.slice(0, 2).toUpperCase()
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

export function ProfilePage({ profile }: { profile: ProfileData }) {
  const [fullName, setFullName] = useState(profile.full_name || "")
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "")
  const [previewUrl, setPreviewUrl] = useState(profile.avatar_url || "")
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setMessage("")
    setError("")

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          avatar_url: avatarUrl,
        }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || "Could not save profile.")
      }

      setPreviewUrl(result.profile?.avatar_url || "")
      setMessage("Profile saved.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save profile.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/app" className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 text-white shadow-sm">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">Profile</div>
              <div className="truncate text-xs text-slate-500">Account identity and visible workspace details</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Button asChild variant="outline" size="sm" className="border-slate-200 bg-white text-slate-700">
              <Link href="/app">Open dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Surface
            title="User Profile"
            description="This information is used inside the platform account menu and can be refreshed from Google sign-in data."
          >
            <div className="grid gap-5 md:grid-cols-[132px_1fr]">
              <div className="flex flex-col items-center gap-3">
                <div className="grid h-28 w-28 overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-3xl font-semibold text-slate-500">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setPreviewUrl("")}
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center">{initials(fullName || profile.email)}</span>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    profile.google_connected ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"
                  )}
                >
                  {profile.google_connected ? <CheckCircle2 className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                  {profile.google_connected ? "Google connected" : "Password account"}
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="full_name">Display name</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Your name"
                    className="bg-white"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profile.email} disabled className="bg-slate-50 text-slate-500" />
                  <p className="text-xs leading-5 text-slate-500">Email is used for login and workspace ownership. Editing email can be added later with verification.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="avatar_url">Avatar URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="avatar_url"
                      value={avatarUrl}
                      onChange={(event) => setAvatarUrl(event.target.value)}
                      placeholder="https://..."
                      className="bg-white"
                    />
                    <Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => setPreviewUrl(avatarUrl)}>
                      Preview
                    </Button>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">Google sign-in fills this automatically when Google returns a profile image. You can also paste another HTTPS image URL.</p>
                </div>

                {message ? <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}
                {error ? <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {isSaving ? "Saving" : "Save profile"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-200 bg-white"
                    onClick={() => {
                      setAvatarUrl("")
                      setPreviewUrl("")
                    }}
                  >
                    Remove avatar
                  </Button>
                </div>
              </div>
            </div>
          </Surface>
        </form>

        <div className="space-y-5">
          <Surface title="Account Details" description="Read-only identity fields stored in the tenant user registry.">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-slate-500"><Mail className="h-4 w-4" /> Email</span>
                <span className="truncate text-sm font-semibold text-slate-900">{profile.email}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-slate-500"><ShieldCheck className="h-4 w-4" /> Role</span>
                <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">{profile.role || "owner"}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-slate-500"><UserRound className="h-4 w-4" /> Provider</span>
                <span className="text-sm font-semibold capitalize text-slate-900">{profile.auth_provider || "password"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-slate-500"><ImageIcon className="h-4 w-4" /> Avatar</span>
                <span className="text-sm font-semibold text-slate-900">{previewUrl ? "Configured" : "Not set"}</span>
              </div>
            </div>
          </Surface>

          <Surface title="Google Data" description="Google profile data is imported when the user signs in with Google OAuth.">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>Name and avatar can be updated from Google on the next Google login, then adjusted manually here.</p>
              <Button asChild variant="outline" className="w-full border-slate-200 bg-white">
                <Link href={`/api/auth/google?next=${encodeURIComponent("/profile")}`}>
                  Refresh from Google
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Surface>
        </div>
      </div>
    </main>
  )
}
