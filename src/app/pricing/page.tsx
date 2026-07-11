import type { Metadata } from "next"
import Link from "next/link"
import { getCurrentProfile } from "@/app/actions/auth"
import { PricingCards } from "@/components/features/billing/pricing-cards"
import { AppFooter } from "@/components/features/layout/app-footer"
import { BILLING_UI } from "@/lib/plans"

export const metadata: Metadata = {
  title: "料金プラン",
}

export default async function PricingPage() {
  let currentPlan: string | null = null
  let isLoggedIn = false
  try {
    const profile = await getCurrentProfile()
    isLoggedIn = Boolean(profile)
    const org = Array.isArray(profile?.organizations)
      ? profile?.organizations[0]
      : profile?.organizations
    currentPlan = org?.plan ?? null
  } catch {
    // 未ログイン・未設定時はそのまま
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-border bg-background px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link
            href={isLoggedIn ? "/" : "/login"}
            className="inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              監
            </span>
            <span>
              <span className="block text-base font-bold text-primary-dark">
                監査のミカタ
              </span>
              <span className="block text-xs text-muted-foreground">
                AI書類Wチェック
              </span>
            </span>
          </Link>
          <Link
            href={isLoggedIn ? "/settings" : "/login?next=/pricing"}
            className="text-base font-medium text-primary underline-offset-4 hover:underline"
          >
            {isLoggedIn ? "設定へ" : "ログイン"}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold text-primary-dark">
            {BILLING_UI.pricingTitle}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {BILLING_UI.pricingDescription}
          </p>
        </div>
        <PricingCards showCheckout currentPlan={currentPlan} />
      </main>

      <AppFooter />
    </div>
  )
}
