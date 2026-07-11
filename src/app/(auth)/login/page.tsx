import { Suspense } from "react"
import type { Metadata } from "next"
import { LoginForm } from "@/components/features/auth/login-form"

export const metadata: Metadata = {
  title: "ログイン",
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">読み込み中…</p>}>
      <LoginForm />
    </Suspense>
  )
}
