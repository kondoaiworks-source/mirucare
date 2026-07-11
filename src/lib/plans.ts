import type { PlanType } from "@/types/database"

/** ライト：月間チェック回数上限（書類単位） */
export const LIGHT_MONTHLY_CHECK_LIMIT = 1

export const PLAN_CATALOG = {
  light: {
    id: "light" as const,
    name: "ライト",
    priceYen: 19800,
    description: "月1回の一括チェックで、まずはWチェックを始められます。",
    features: ["月1回の書類チェック", "指摘の確認・対応", "書類・結果の閲覧"],
  },
  standard: {
    id: "standard" as const,
    name: "スタンダード",
    priceYen: 29800,
    description: "毎日のチェックと期限アラートで、現場の確認を習慣化できます。",
    features: [
      "毎日の書類チェック",
      "期限アラート",
      "指摘の確認・対応",
      "書類・結果の閲覧",
    ],
    featured: true,
  },
  premium: {
    id: "premium" as const,
    name: "プレミアム",
    priceYen: 39800,
    description: "月次レポートで、施設内会議や法人本部への報告までカバーします。",
    features: [
      "スタンダードのすべて",
      "月次レポート（原因分析）",
      "PDF出力",
    ],
  },
} as const

export const SETUP_FEE_YEN = 50000

export const BILLING_UI = {
  pricingTitle: "料金プラン",
  pricingDescription:
    "事業所のペースに合わせて選べます。カード変更・解約はお客様ポータルから行えます。",
  setupFeeNote: `初期導入費 ${SETUP_FEE_YEN.toLocaleString("ja-JP")}円（税別・初回のみ）`,
  subsidyNote: "IT導入補助金のご相談も承ります",
  contactLabel: "お問い合わせ",
  contactHref: "mailto:support@mirucare.example",
  featuredBadge: "主力プラン",
  taxNote: "表示価格は税別です",
  perMonth: "円／月",
  checkoutCta: "このプランで契約する",
  portalCta: "カード変更・解約する",
  reSubscribeCta: "プランを選び直す",
  viewOnlyTitle: "現在は閲覧のみご利用いただけます",
  viewOnlyBody:
    "解約後もこれまでの書類とチェック結果は残っています。再契約すると、またチェックを始められます。",
  lightLimitReached:
    "今月の上限に達しました。スタンダードなら毎日チェックできます",
  noPlanCheck:
    "チェックを始めるにはプランのご契約が必要です。料金ページからお選びください。",
  alertsLockedTitle: "期限アラートはスタンダード以上でご利用いただけます",
  alertsLockedBody:
    "毎日のチェックとあわせて、同意日・更新期限などの見落とし防止に使えます。",
  upgradeToStandard: "スタンダードを見る",
} as const

export function planLabel(plan: PlanType | null | undefined): string {
  if (plan === "premium") return PLAN_CATALOG.premium.name
  if (plan === "standard") return PLAN_CATALOG.standard.name
  if (plan === "light") return PLAN_CATALOG.light.name
  return "未契約"
}

export function canStartCheck(plan: PlanType | null | undefined): boolean {
  return plan === "light" || plan === "standard" || plan === "premium"
}

export function canUseAlerts(plan: PlanType | null | undefined): boolean {
  return plan === "standard" || plan === "premium"
}

export function canUseReports(plan: PlanType | null | undefined): boolean {
  return plan === "premium"
}

export function monthlyCheckLimit(
  plan: PlanType | null | undefined
): number | null {
  if (plan === "light") return LIGHT_MONTHLY_CHECK_LIMIT
  if (plan === "standard" || plan === "premium") return null
  return 0
}

export function currentMonthRange(now = new Date()): {
  startIso: string
  endIso: string
} {
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export function isCheckoutPlan(
  value: string
): value is "light" | "standard" | "premium" {
  return value === "light" || value === "standard" || value === "premium"
}

/** Stripe Checkout は Price ID（price_…）が必要。Product ID（prod_…）は不可 */
function asStripePriceId(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/^["']|["']$/g, "")
  if (!trimmed) return undefined
  if (trimmed.startsWith("price_")) return trimmed
  return undefined
}

export function priceIdForPlan(
  plan: "light" | "standard" | "premium"
): string | undefined {
  if (plan === "light") return asStripePriceId(process.env.STRIPE_PRICE_LIGHT)
  if (plan === "standard")
    return asStripePriceId(process.env.STRIPE_PRICE_STANDARD)
  return asStripePriceId(process.env.STRIPE_PRICE_PREMIUM)
}

export function setupPriceId(): string | undefined {
  return asStripePriceId(process.env.STRIPE_PRICE_SETUP)
}

export function planFromPriceId(priceId: string | null | undefined): PlanType {
  if (!priceId) return "none"
  const light = asStripePriceId(process.env.STRIPE_PRICE_LIGHT)
  const standard = asStripePriceId(process.env.STRIPE_PRICE_STANDARD)
  const premium = asStripePriceId(process.env.STRIPE_PRICE_PREMIUM)
  if (priceId === light) return "light"
  if (priceId === standard) return "standard"
  if (priceId === premium) return "premium"
  return "none"
}
