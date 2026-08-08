import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "監視状況",
}

/** 旧「監視トラブル」→ 監視状況へ集約 */
export default function RulesMorePage() {
  redirect("/admin/rules/monitoring")
}
