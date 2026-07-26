import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "ルール設定",
}

/**
 * ルール設定の入口はルールブック設定（市一覧・確定版）。
 * 旧ホームは廃止。
 */
export default function RulesDashboardPage() {
  redirect("/admin/rules/regulatory")
}
