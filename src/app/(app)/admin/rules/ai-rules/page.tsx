import type { Metadata } from "next"
import { AiRulesAdmin } from "@/components/features/admin/rules/ai-rules-admin"

export const metadata: Metadata = { title: "AI判定ルール" }

export default function Page() {
  return <AiRulesAdmin />
}
