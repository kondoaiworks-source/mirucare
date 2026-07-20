import type { Metadata } from "next"
import { RulesHistoryAdmin } from "@/components/features/admin/rules/rules-history-admin"

export const metadata: Metadata = { title: "更新履歴" }

export default function Page() {
  return <RulesHistoryAdmin />
}
