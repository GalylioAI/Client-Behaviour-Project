import { LoginPage } from "@/components/auth/login-page"

export const dynamic = "force-dynamic"
export const revalidate = 0

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function Login({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawNext = params.next
  const nextPath = Array.isArray(rawNext) ? rawNext[0] : rawNext
  const safeNext = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/app"
  return <LoginPage nextPath={safeNext} />
}
