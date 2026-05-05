import { CustomerOnboardingClient } from "@/components/onboarding/customer-onboarding-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function StartPage() {
  return <CustomerOnboardingClient />
}
