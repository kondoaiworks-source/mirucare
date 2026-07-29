import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = { title: "更新履歴" }

/** 更新履歴はルール管理ページ内へ集約。旧URL互換。 */
export default function Page() {
  redirect("/admin/rules/pending#history")
}
