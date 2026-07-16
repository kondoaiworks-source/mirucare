import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DocumentList } from "@/components/features/documents/document-list"
import {
  healStuckCheckingDocumentsAction,
  listDocumentsAction,
} from "@/app/actions/documents"
import { DocumentsSkeleton } from "@/components/features/skeletons/page-skeletons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "日次チェック",
}

export default function DocumentsPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-primary-dark">日次チェック</h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            書類自体の不備をAIで確認します。まず何をチェックするかを選んでからアップロードしましょう。
          </p>
        </div>
        <Button asChild size="lg" className="w-full shrink-0 sm:w-auto">
          <Link href="/check/upload">今日の分をチェックする</Link>
        </Button>
      </div>

      <Suspense fallback={<DocumentsSkeleton />}>
        <DocumentsListContent />
      </Suspense>
    </div>
  )
}

async function DocumentsListContent() {
  await healStuckCheckingDocumentsAction()
  const result = await listDocumentsAction()
  const documents = result.data?.documents ?? []

  if (!result.ok) {
    return (
      <Alert variant="destructive" className="rounded-lg">
        <AlertCircle />
        <AlertTitle>一覧を取得できませんでした</AlertTitle>
        <AlertDescription>
          {result.error ??
            "通信状況をご確認のうえ、ページを再読み込みしてください。"}
        </AlertDescription>
      </Alert>
    )
  }

  return <DocumentList documents={documents} />
}
