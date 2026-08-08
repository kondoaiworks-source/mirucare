import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "ルール設定",
}

/**
 * ルール設定の入口は利用設定。
 */
export default function RulesDashboardPage() {
  redirect("/admin/rules/setup")
}
