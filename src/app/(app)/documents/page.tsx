import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "監査結果の履歴",
}

/** 旧「日次チェック」→ 監査結果の履歴へ */
export default function DocumentsRedirectPage() {
  redirect("/audit-history")
}
