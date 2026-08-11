import { redirect } from "next/navigation"

export const metadata = { title: "利用設定" }

/** カテゴリの事前登録は不要。サービスハブへ戻す。 */
export default function Page() {
  redirect("/admin/rules/services/homecare")
}
