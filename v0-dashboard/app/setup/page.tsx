import { ControlPlaneClient } from "@/components/setup/control-plane-client"
import { loadControlPlane } from "@/lib/control-plane"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function SetupPage() {
  const data = await loadControlPlane()
  return <ControlPlaneClient data={data} />
}
