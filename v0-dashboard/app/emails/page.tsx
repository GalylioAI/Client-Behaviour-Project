import { EmailsPage } from "@/components/emails/emails-page"
import { loadOnboardingEmails } from "@/lib/onboarding-email"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function EmailOutboxPage() {
  const emails = await loadOnboardingEmails()
  return <EmailsPage emails={emails} />
}
