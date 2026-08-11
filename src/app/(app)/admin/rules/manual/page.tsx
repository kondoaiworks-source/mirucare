import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "手動で判定ルール生成",
}

/** 全市の手動生成は廃止。国・県または各市の判定ルール管理から開く。 */
export default function Page() {
  redirect("/admin/rules/setup")
}
