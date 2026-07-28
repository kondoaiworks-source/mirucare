import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import { requireOperator } from "@/lib/operator"
import { DocumentChangesAdmin } from "@/components/features/admin/document-changes-admin"
import { countPendingChangeDraftsAction } from "@/app/actions/knowledge-change-drafts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "マニュアル変更の承認",
}

export default async function AdminDocumentChangesPage() {
  const op = await requireOperator()
  if ("error" in op) {
    redirect("/")
  }

  const pending = await countPendingChangeDraftsAction()
  const count = pending.ok ? (pending.data?.count ?? 0) : 0

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-end gap-2">
        {count > 0 ? (
          <Badge
            variant="destructive"
            className="h-8 rounded-lg px-3 text-sm tabular-nums"
          >
            新ルール判定通知 {count}件
          </Badge>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/admin/rules/documents">行政ルール台帳</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin">レビューコンソール</Link>
        </Button>
      </div>
      <Suspense
        fallback={<p className="text-base text-muted-foreground">読み込み中…</p>}
      >
        <DocumentChangesAdmin />
      </Suspense>
    </div>
  )
}
