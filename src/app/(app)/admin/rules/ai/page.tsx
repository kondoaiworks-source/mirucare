import type { Metadata } from "next"
import { PurposeHub } from "@/components/features/admin/purpose-hub"
import { getPurposeSection } from "@/lib/rule-engine/purpose-sections"

export const metadata: Metadata = {
  title: "AI設定",
}

export default function AiSettingsHubPage() {
  const section = getPurposeSection("ai")
  if (!section) return null
  return <PurposeHub section={section} />
}
