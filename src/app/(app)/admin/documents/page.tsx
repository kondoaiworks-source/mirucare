import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { requireOperator } from "@/lib/operator"
import { KnowledgeDocumentsAdmin } from "@/components/features/admin/knowledge-documents-admin"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "行政マニュアル管理",
}

export default async function AdminKnowledgeDocumentsPage() {
  const op = await requireOperator()
  if ("error" in op) {
    redirect("/")
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/admin">レビューコンソール</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/reports">月次レポート管理</Link>
        </Button>
      </div>
      <KnowledgeDocumentsAdmin />
    </div>
  )
}
