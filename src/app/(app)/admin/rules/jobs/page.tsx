import type { Metadata } from "next"
import { RulesJobsAdmin } from "@/components/features/admin/rules/rules-jobs-admin"

export const metadata: Metadata = { title: "運用監視" }

export default function Page() {
  return <RulesJobsAdmin />
}
