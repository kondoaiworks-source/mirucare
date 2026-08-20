import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = { title: "利用設定" }

/** 領域マスタはUIから外した。利用設定（マスタ管理）へ戻す。 */
export default function RuleDomainsPage() {
  redirect("/admin/rules/setup")
}
