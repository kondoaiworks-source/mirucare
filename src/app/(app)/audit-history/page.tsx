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
import { PageHeader } from "@/components/features/layout/page-header"

export const metadata: Metadata = {
  title: "監査結果",
}

export default function AuditHistoryPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <PageHeader
        title="監査結果"
        description="過去の監査結果と、指摘への対応状況を確認できます。結果は匿名表記で残ります。原本は短期間で削除されます。"
        action={
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/check/upload">監査書類をアップロードする</Link>
          </Button>
        }
      />

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
        <AlertTitle>一覧を表示できませんでした</AlertTitle>
        <AlertDescription>
          {result.error ??
            "通信状況をご確認のうえ、ページを再読み込みしてください。"}
        </AlertDescription>
      </Alert>
    )
  }

  return <DocumentList documents={documents} />
}
