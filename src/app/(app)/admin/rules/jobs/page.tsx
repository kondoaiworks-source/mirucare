import { redirect } from "next/navigation"

/** 同期の結果は監視トラブルへ統合 */
export default function Page() {
  redirect("/admin/rules/more")
}
