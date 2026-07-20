import type { Metadata } from "next"
import { PendingRulesAdmin } from "@/components/features/admin/rules/pending-rules-admin"

export const metadata: Metadata = { title: "承認待ち" }

export default function Page() {
  return <PendingRulesAdmin />
}
