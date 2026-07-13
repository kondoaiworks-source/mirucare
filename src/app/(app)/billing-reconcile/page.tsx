import type { Metadata } from "next"
import { BillingReconcileView } from "@/components/features/billing/billing-reconcile-view"

export const metadata: Metadata = {
  title: "請求CSVの突合",
}

export default function BillingReconcilePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <BillingReconcileView />
    </div>
  )
}
