import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = { title: "ルール一覧" }

/** 全市の一覧は廃止。国・県または各市の判定ルール管理へ。 */
export default function Page() {
  redirect("/admin/rules/setup")
}
