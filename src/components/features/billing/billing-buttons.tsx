"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  createBillingPortalSessionAction,
  createCheckoutSessionAction,
} from "@/app/actions/billing"

type CheckoutButtonProps = {
  plan: "light" | "standard" | "premium"
  label?: string
  variant?: "default" | "outline"
  className?: string
}

export function CheckoutButton({
  plan,
  label = "このプランで契約する",
  variant = "default",
  className,
}: CheckoutButtonProps) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Button
      type="button"
      size="lg"
      variant={variant}
      className={className}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await createCheckoutSessionAction(plan)
          if (!result.ok || !result.data?.url) {
            toast.error(result.error ?? "決済ページを開けませんでした")
            if (result.error?.includes("ログイン")) {
              router.push(`/login?next=/pricing`)
            }
            return
          }
          window.location.href = result.data.url
        })
      }}
    >
      {pending ? "準備しています…" : label}
    </Button>
  )
}

export function BillingPortalButton({
  label = "カード変更・解約する",
}: {
  label?: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await createBillingPortalSessionAction()
          if (!result.ok || !result.data?.url) {
            toast.error(result.error ?? "ポータルを開けませんでした")
            return
          }
          window.location.href = result.data.url
        })
      }}
    >
      {pending ? "開いています…" : label}
    </Button>
  )
}
