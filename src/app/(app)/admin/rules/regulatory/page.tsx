import type { Metadata } from "next"
import { PurposeHub } from "@/components/features/admin/purpose-hub"
import { getPurposeSection } from "@/lib/rule-engine/purpose-sections"

export const metadata: Metadata = {
  title: "行政情報",
}

export default function RegulatoryHubPage() {
  const section = getPurposeSection("regulatory")
  if (!section) return null
  return <PurposeHub section={section} />
}
