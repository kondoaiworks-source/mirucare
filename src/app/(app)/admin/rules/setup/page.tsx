import type { Metadata } from "next"
import { UsageSettingsHub } from "@/components/features/admin/rules/usage-settings-hub"

export const metadata: Metadata = {
  title: "利用設定",
}

export default function RulesSetupPage() {
  return <UsageSettingsHub />
}
