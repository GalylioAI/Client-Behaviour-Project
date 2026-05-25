import { EmailsPage } from "@/components/emails/emails-page"
import { requireSession } from "@/lib/auth"
import { loadOnboardingEmails } from "@/lib/onboarding-email"
import { loadRecommendationEmails } from "@/lib/recommendation-email"
import { loadTenantSites } from "@/lib/tenant-access"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"
export const revalidate = 0

type EmailOutboxPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function EmailOutboxPage({ searchParams }: EmailOutboxPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawSiteId = params.site_id
  const requestedSiteId = Array.isArray(rawSiteId) ? rawSiteId[0] : rawSiteId
  const next = `/emails${requestedSiteId ? `?site_id=${encodeURIComponent(requestedSiteId)}` : ""}`
  const session = await requireSession(next)

  let dataError = ""
  const sites = await loadTenantSites(session.tenant_id).catch((error) => {
    console.error("Could not load tenant sites for email outbox", error)
    dataError = "The email outbox could not reach the analytics database. Try refreshing in a moment."
    return []
  })

  if (!sites.length) {
    if (!requestedSiteId) redirect("/start")
    return (
      <EmailsPage
        emails={[]}
        recommendationEmails={[]}
        sites={[]}
        selectedSiteId={requestedSiteId}
        dataError={dataError || "The email outbox could not reach the analytics database. Try refreshing in a moment."}
      />
    )
  }

  const selectedSiteId = requestedSiteId && sites.some((site) => site.site_id === requestedSiteId)
    ? requestedSiteId
    : sites[0].site_id

  const [emails, recommendationEmails] = await Promise.all([
    loadOnboardingEmails(session.tenant_id, selectedSiteId),
    loadRecommendationEmails(session.tenant_id, selectedSiteId),
  ]).catch((error) => {
    console.error("Could not load email outbox rows", error)
    dataError = "The website list loaded, but the email rows could not be loaded from the analytics database. Try refreshing in a moment."
    return [[], []] as const
  })

  return <EmailsPage emails={emails} recommendationEmails={recommendationEmails} sites={sites} selectedSiteId={selectedSiteId} dataError={dataError} />
}
