import { CustomerOnboardingClient } from "@/components/onboarding/customer-onboarding-client"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function StartPage() {
  const session = await getSession()
  return (
    <CustomerOnboardingClient
      initialEmail={session?.email || ""}
      isAuthenticated={Boolean(session)}
    />
  )
}
