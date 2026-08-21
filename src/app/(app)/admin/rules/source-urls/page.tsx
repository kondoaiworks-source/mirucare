import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = { title: "根拠情報" }

/** 根拠URL設定は本線から外した。根拠情報（国・県・市の読むPDFとリンク集）へ戻す。 */
export default function RuleSourceUrlsPage() {
  redirect("/admin/rules/services/homecare/sources")
}
