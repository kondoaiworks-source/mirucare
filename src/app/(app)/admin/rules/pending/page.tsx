import type { Metadata } from "next"
import { PendingRulesAdmin } from "@/components/features/admin/rules/pending-rules-admin"

export const metadata: Metadata = { title: "新ルール判定通知" }

export default function Page() {
  return <PendingRulesAdmin />
}
