import type { Metadata } from "next"
import { RulesJobsAdmin } from "@/components/features/admin/rules/rules-jobs-admin"

export const metadata: Metadata = { title: "同期の結果" }

export default function Page() {
  return <RulesJobsAdmin />
}
