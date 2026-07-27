import { redirect } from "next/navigation"

/** 同期の結果は連携監視へ統合 */
export default function Page() {
  redirect("/admin/rules/documents?view=all")
}
