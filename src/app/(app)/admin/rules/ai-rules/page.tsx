import type { Metadata } from "next"
import { AiRulesAdmin } from "@/components/features/admin/rules/ai-rules-admin"

export const metadata: Metadata = { title: "AIルール管理" }

export default function Page() {
  return <AiRulesAdmin />
}
