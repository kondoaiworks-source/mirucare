import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import {
  clearSubscriptionOnOrg,
  handleCheckoutCompleted,
  syncSubscriptionToOrg,
} from "@/lib/stripe-sync"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET が未設定です" },
      { status: 500 }
    )
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "署名がありません" }, { status: 400 })
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (error) {
    console.error("[stripe] webhook signature", error)
    return NextResponse.json({ error: "署名検証に失敗しました" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        if (session.subscription) {
          const stripe = getStripe()
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id
          const sub = await stripe.subscriptions.retrieve(subId)
          await syncSubscriptionToOrg(
            sub,
            session.metadata?.organization_id
          )
        }
        break
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        await syncSubscriptionToOrg(sub)
        break
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await clearSubscriptionOnOrg(sub)
        break
      }
      default:
        break
    }
  } catch (error) {
    console.error("[stripe] webhook handler", error)
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
