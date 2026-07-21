import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { requireOperator } from "@/lib/operator"
import { getReviewConsoleDataAction } from "@/app/actions/admin-review"
import { AdminReviewConsole } from "@/components/features/admin/admin-review-console"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { ADMIN_REVIEW_UI } from "@/lib/admin-review"

export const metadata: Metadata = {
  title: "レビューコンソール",
}

export default async function AdminReviewPage() {
  const op = await requireOperator()
  if ("error" in op) {
    redirect("/")
  }

  const result = await getReviewConsoleDataAction()

  if (!result.ok || !result.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold text-primary-dark">
          {ADMIN_REVIEW_UI.title}
        </h1>
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle />
          <AlertTitle>コンソールを開けませんでした</AlertTitle>
          <AlertDescription>
            {result.error ??
              "Supabase SQL Editor で supabase/migrations/20260711060000_admin_review.sql を実行してください。"}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/admin/rules">チェック設定</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/rules/documents">行政資料</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/document-changes">マニュアル変更の承認</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/reports">月次レポート管理</Link>
        </Button>
      </div>
      <AdminReviewConsole
        initialQueue={result.data.queue}
        initialMetrics={result.data.metrics}
        initialFeedback={result.data.feedback}
      />
    </div>
  )
}
