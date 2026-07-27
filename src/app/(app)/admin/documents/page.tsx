import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireOperator } from "@/lib/operator"

export const metadata: Metadata = {
  title: "手動管理",
}

/** 旧URL互換：チェック設定配下の手動管理へ誘導 */
export default async function AdminKnowledgeDocumentsRedirectPage() {
  const op = await requireOperator()
  if ("error" in op) {
    redirect("/")
  }
  redirect("/admin/rules/documents")
}
