import { ForgotPasswordPage } from "@/components/auth/forgot-password-page"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function ForgotPassword() {
  return <ForgotPasswordPage />
}
