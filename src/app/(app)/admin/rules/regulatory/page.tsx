import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "ルールブック管理",
}

/** 旧ハブ → 訪問介護 */
export default function RegulatoryHubPage() {
  redirect("/admin/rules/services/homecare")
}
