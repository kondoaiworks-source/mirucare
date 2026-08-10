import type { Metadata } from "next"
import { PendingRulesAdmin } from "@/components/features/admin/rules/pending-rules-admin"

export const metadata: Metadata = { title: "判定ルール管理" }

export default function Page() {
  return <PendingRulesAdmin />
}
