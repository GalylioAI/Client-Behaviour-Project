import { ControlPlaneClient } from "@/components/setup/control-plane-client"
import { requireSession } from "@/lib/auth"
import { loadControlPlane } from "@/lib/control-plane"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function SetupPage() {
  const session = await requireSession("/setup")
  const data = await loadControlPlane(session.tenant_id)
  return <ControlPlaneClient data={data} />
}
