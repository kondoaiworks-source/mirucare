import { redirect } from "next/navigation"

/** 同期の結果は監視状況へ統合 */
export default function Page() {
  redirect("/admin/rules/monitoring")
}
