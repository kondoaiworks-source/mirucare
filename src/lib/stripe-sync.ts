import { createServiceClient } from "@/lib/supabase/server"
import { planFromPriceId } from "@/lib/plans"
import type { PlanType } from "@/types/database"
import type Stripe from "stripe"

type OrgBillingPatch = {
  plan?: PlanType
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  stripe_subscription_status?: string | null
  setup_fee_paid_at?: string | null
}

async function updateOrgById(orgId: string, patch: OrgBillingPatch) {
  const admin = createServiceClient()
  const { error } = await admin
    .from("organizations")
    .update(patch)
    .eq("id", orgId)
  if (error) throw new Error(error.message)
}

async function findOrgIdByCustomer(customerId: string): Promise<string | null> {
  const admin = createServiceClient()
  const { data } = await admin
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  return data?.id ?? null
}

function subscriptionPlan(sub: Stripe.Subscription): PlanType {
  const priceId = sub.items.data[0]?.price?.id
  return planFromPriceId(priceId)
}

function isActiveStatus(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing"
}

export async function syncSubscriptionToOrg(
  sub: Stripe.Subscription,
  organizationId?: string
) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id
  const orgId =
    organizationId ??
    sub.metadata.organization_id ??
    (await findOrgIdByCustomer(customerId))

  if (!orgId) {
    console.error("[stripe] organization not found for subscription", sub.id)
    return
  }

  const status = sub.status
  const plan = isActiveStatus(status) ? subscriptionPlan(sub) : "none"

  await updateOrgById(orgId, {
    plan,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    stripe_subscription_status: status,
  })
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
) {
  const orgId = session.metadata?.organization_id
  if (!orgId) {
    console.error("[stripe] checkout missing organization_id")
    return
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id

  const patch: OrgBillingPatch = {
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: subscriptionId ?? null,
  }

  if (session.metadata?.include_setup_fee === "1") {
    patch.setup_fee_paid_at = new Date().toISOString()
  }

  if (session.metadata?.plan && isActiveCheckoutPlan(session.metadata.plan)) {
    patch.plan = session.metadata.plan
    patch.stripe_subscription_status = "active"
  }

  await updateOrgById(orgId, patch)
}

function isActiveCheckoutPlan(
  value: string
): value is "light" | "standard" | "premium" {
  return value === "light" || value === "standard" || value === "premium"
}

export async function clearSubscriptionOnOrg(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id
  const orgId =
    sub.metadata.organization_id ?? (await findOrgIdByCustomer(customerId))
  if (!orgId) return

  // 解約後もデータは残し、plan=none で閲覧のみ
  await updateOrgById(orgId, {
    plan: "none",
    stripe_subscription_id: null,
    stripe_subscription_status: "canceled",
    stripe_customer_id: customerId,
  })
}
