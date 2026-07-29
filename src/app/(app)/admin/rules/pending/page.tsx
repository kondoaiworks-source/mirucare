import type { Metadata } from "next"
import { PendingRulesAdmin } from "@/components/features/admin/rules/pending-rules-admin"
import { RulesHistoryAdmin } from "@/components/features/admin/rules/rules-history-admin"

export const metadata: Metadata = { title: "ルール管理" }

export default function Page() {
  return (
    <div className="space-y-10">
      <PendingRulesAdmin />
      <RulesHistoryAdmin embedded />
    </div>
  )
}
