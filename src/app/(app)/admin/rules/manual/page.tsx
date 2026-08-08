import type { Metadata } from "next"
import { ManualCheckRulePage } from "@/components/features/admin/rules/manual-check-rule-page"

export const metadata: Metadata = {
  title: "手動で判定ルール生成",
}

export default function Page() {
  return <ManualCheckRulePage />
}
