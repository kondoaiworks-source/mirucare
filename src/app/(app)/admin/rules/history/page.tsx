import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = { title: "ルール一覧" }

/** 旧「更新履歴」URL互換。ルール管理内のルール一覧へ。 */
export default function Page() {
  redirect("/admin/rules/pending#rules-list")
}
