import { redirect } from "next/navigation"

import { ProfilePage } from "@/components/profile/profile-page"
import { findUserByEmail, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function UserProfilePage() {
  const session = await requireSession("/profile")
  const user = await findUserByEmail(session.email)

  if (!user || user.user_id !== session.user_id || user.tenant_id !== session.tenant_id) {
    redirect("/login")
  }

  return (
    <ProfilePage
      profile={{
        user_id: user.user_id,
        tenant_id: user.tenant_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        status: user.status,
        auth_provider: user.auth_provider || "password",
        google_connected: Boolean(user.google_sub),
        avatar_url: user.avatar_url || "",
      }}
    />
  )
}
