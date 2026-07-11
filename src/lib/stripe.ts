import Stripe from "stripe"

let stripeSingleton: Stripe | null = null

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function getStripe(): Stripe {
  const key = trimEnv(process.env.STRIPE_SECRET_KEY)
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY が未設定です")
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      typescript: true,
    })
  }
  return stripeSingleton
}

export function siteUrl(): string {
  return (
    trimEnv(process.env.NEXT_PUBLIC_SITE_URL)?.replace(/\/$/, "") ??
    "http://localhost:3000"
  )
}
