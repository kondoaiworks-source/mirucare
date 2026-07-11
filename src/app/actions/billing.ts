"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getStripe, siteUrl } from "@/lib/stripe"
import {
  BILLING_UI,
  canStartCheck,
  currentMonthRange,
  isCheckoutPlan,
  monthlyCheckLimit,
  priceIdForPlan,
  setupPriceId,
} from "@/lib/plans"
import type { PlanType } from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

async function requireBillingContext() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error:
        "ログインの有効期限が切れた可能性があります。再度ログインしてください。",
    } as const
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      organization_id,
      role,
      organizations (
        id,
        name,
        plan,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_subscription_status,
        setup_fee_paid_at
      )
    `
    )
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return {
      error:
        "事業所情報を取得できませんでした。オンボーディングが完了しているかご確認ください。",
    } as const
  }

  const orgRaw = profile.organizations
  const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw
  if (!org) {
    return { error: "事業所情報を取得できませんでした。" } as const
  }

  return {
    supabase,
    user,
    organizationId: profile.organization_id as string,
    role: profile.role as string,
    email: user.email ?? undefined,
    org: org as {
      id: string
      name: string
      plan: PlanType
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      stripe_subscription_status: string | null
      setup_fee_paid_at: string | null
    },
  } as const
}

export async function createCheckoutSessionAction(
  plan: string
): Promise<ActionResult<{ url: string }>> {
  if (!isCheckoutPlan(plan)) {
    return { ok: false, error: "プランの指定が正しくありません。" }
  }

  const ctx = await requireBillingContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  if (ctx.role !== "admin") {
    return {
      ok: false,
      error: "プランの契約・変更は事業所の管理者のみ行えます。",
    }
  }

  const priceId = priceIdForPlan(plan)
  const setupFeePriceId = setupPriceId()
  if (!priceId) {
    return {
      ok: false,
      error:
        "Stripeの価格ID（price_…）が未設定です。商品ID（prod_…）ではなく Price ID を .env に設定してください。",
    }
  }

  try {
    const stripe = getStripe()
    let customerId = ctx.org.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ctx.email,
        name: ctx.org.name,
        metadata: { organization_id: ctx.organizationId },
      })
      customerId = customer.id
      const admin = createServiceClient()
      await admin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", ctx.organizationId)
    }

    const includeSetup =
      !ctx.org.setup_fee_paid_at && Boolean(setupFeePriceId)
    const lineItems: { price: string; quantity: number }[] = [
      { price: priceId, quantity: 1 },
    ]
    if (includeSetup && setupFeePriceId) {
      lineItems.push({ price: setupFeePriceId, quantity: 1 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      success_url: `${siteUrl()}/settings?billing=success`,
      cancel_url: `${siteUrl()}/pricing?billing=cancel`,
      client_reference_id: ctx.organizationId,
      metadata: {
        organization_id: ctx.organizationId,
        plan,
        include_setup_fee: includeSetup ? "1" : "0",
      },
      subscription_data: {
        metadata: {
          organization_id: ctx.organizationId,
          plan,
        },
      },
      allow_promotion_codes: true,
    })

    if (!session.url) {
      return { ok: false, error: "Checkout URL を作成できませんでした。" }
    }

    return { ok: true, data: { url: session.url } }
  } catch (error) {
    console.error("[stripe] checkout", error)
    return {
      ok: false,
      error:
        "決済ページを開けませんでした。しばらくしてから再度お試しください。",
    }
  }
}

export async function createBillingPortalSessionAction(): Promise<
  ActionResult<{ url: string }>
> {
  const ctx = await requireBillingContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  if (ctx.role !== "admin") {
    return {
      ok: false,
      error: "カード変更・解約は事業所の管理者のみ行えます。",
    }
  }

  if (!ctx.org.stripe_customer_id) {
    return {
      ok: false,
      error: "まだご契約がありません。料金ページからプランをお選びください。",
    }
  }

  try {
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: ctx.org.stripe_customer_id,
      return_url: `${siteUrl()}/settings`,
    })
    return { ok: true, data: { url: session.url } }
  } catch (error) {
    console.error("[stripe] portal", error)
    return {
      ok: false,
      error:
        "お客様ポータルを開けませんでした。しばらくしてから再度お試しください。",
    }
  }
}

export type CheckQuotaResult = {
  allowed: boolean
  plan: PlanType
  used: number
  limit: number | null
  message?: string
}

/** チェック開始前のプラン・月間上限判定 */
export async function assertCanStartChecks(
  organizationId: string
): Promise<CheckQuotaResult> {
  const admin = createServiceClient()
  const { data: org } = await admin
    .from("organizations")
    .select("plan")
    .eq("id", organizationId)
    .maybeSingle()

  const plan = (org?.plan ?? "none") as PlanType

  if (!canStartCheck(plan)) {
    return {
      allowed: false,
      plan,
      used: 0,
      limit: 0,
      message: BILLING_UI.noPlanCheck,
    }
  }

  const limit = monthlyCheckLimit(plan)
  if (limit == null) {
    return { allowed: true, plan, used: 0, limit: null }
  }

  const { startIso, endIso } = currentMonthRange()
  const { count, error } = await admin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .neq("status", "uploaded")
    .gte("updated_at", startIso)
    .lt("updated_at", endIso)

  if (error) {
    return {
      allowed: false,
      plan,
      used: 0,
      limit,
      message: "利用状況の確認に失敗しました。しばらくしてから再度お試しください。",
    }
  }

  const used = count ?? 0
  if (limit != null && used >= limit) {
    return {
      allowed: false,
      plan,
      used,
      limit,
      message: BILLING_UI.lightLimitReached,
    }
  }

  return { allowed: true, plan, used, limit }
}
