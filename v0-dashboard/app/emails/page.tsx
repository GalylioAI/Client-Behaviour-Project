import { EmailsPage } from "@/components/emails/emails-page"
import { requireSession } from "@/lib/auth"
import { loadOnboardingEmails } from "@/lib/onboarding-email"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function EmailOutboxPage() {
  const session = await requireSession("/emails")
  const emails = await loadOnboardingEmails(session.tenant_id)
  return <EmailsPage emails={emails} />
}
