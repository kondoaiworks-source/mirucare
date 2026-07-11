import Link from "next/link"
import {
  BILLING_UI,
  PLAN_CATALOG,
  SETUP_FEE_YEN,
} from "@/lib/plans"
import { CheckoutButton } from "@/components/features/billing/billing-buttons"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type PricingCardsProps = {
  showCheckout?: boolean
  currentPlan?: string | null
}

export function PricingCards({
  showCheckout = true,
  currentPlan,
}: PricingCardsProps) {
  const plans = [
    PLAN_CATALOG.light,
    PLAN_CATALOG.standard,
    PLAN_CATALOG.premium,
  ] as const

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const featured = "featured" in plan && plan.featured
          const isCurrent = currentPlan === plan.id
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-lg border bg-card p-6 shadow-subtle",
                featured
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border"
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold text-primary-dark">
                  {plan.name}
                </h2>
                {featured ? (
                  <Badge className="shrink-0">{BILLING_UI.featuredBadge}</Badge>
                ) : null}
              </div>
              <p className="text-4xl font-bold tabular-nums text-primary-dark">
                {plan.priceYen.toLocaleString("ja-JP")}
                <span className="ml-1 text-base font-semibold text-muted-foreground">
                  {BILLING_UI.perMonth}
                </span>
              </p>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {plan.description}
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-base leading-relaxed">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-primary" aria-hidden>
                      ・
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {showCheckout ? (
                <div className="mt-6">
                  {isCurrent ? (
                    <p className="text-center text-sm font-medium text-primary">
                      ご契約中のプランです
                    </p>
                  ) : (
                    <CheckoutButton
                      plan={plan.id}
                      variant={featured ? "default" : "outline"}
                      className="w-full"
                      label={BILLING_UI.checkoutCta}
                    />
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-border bg-surface px-5 py-4 text-base leading-relaxed text-muted-foreground">
        <p>{BILLING_UI.setupFeeNote}</p>
        <p className="mt-1 text-sm">{BILLING_UI.taxNote}</p>
        <p className="mt-3">
          {BILLING_UI.subsidyNote}
          {" — "}
          <Link
            href={BILLING_UI.contactHref}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {BILLING_UI.contactLabel}
          </Link>
        </p>
        <p className="mt-2 text-sm">
          初期導入費の目安：
          {SETUP_FEE_YEN.toLocaleString("ja-JP")}円（税別・初回のみ）
        </p>
      </div>

      {/* シンプル比較表 */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[28rem] text-left text-base">
          <caption className="sr-only">プラン機能の比較</caption>
          <thead className="bg-surface">
            <tr>
              <th className="px-4 py-3 font-semibold">機能</th>
              <th className="px-4 py-3 font-semibold">ライト</th>
              <th className="px-4 py-3 font-semibold">スタンダード</th>
              <th className="px-4 py-3 font-semibold">プレミアム</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="px-4 py-3">書類チェック</td>
              <td className="px-4 py-3">月1回</td>
              <td className="px-4 py-3">毎日</td>
              <td className="px-4 py-3">毎日</td>
            </tr>
            <tr className="border-t border-border">
              <td className="px-4 py-3">期限アラート</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3">あり</td>
              <td className="px-4 py-3">あり</td>
            </tr>
            <tr className="border-t border-border">
              <td className="px-4 py-3">月次レポート</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3">あり</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
