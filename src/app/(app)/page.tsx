import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DashboardView } from "@/components/features/dashboard/dashboard-view"
import { DashboardSkeleton } from "@/components/features/skeletons/page-skeletons"
import { getDashboardDataAction } from "@/app/actions/deadlines"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "運用AI監査",
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}

async function DashboardContent() {
  const result = await getDashboardDataAction()

  if (!result.ok || !result.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
              運用AI監査
            </h1>
          </div>
          <Button asChild size="lg">
            <Link href="/check/upload">書類をアップロードする</Link>
          </Button>
        </div>
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle />
          <AlertTitle>表示できませんでした</AlertTitle>
          <AlertDescription>
            {result.error ??
              "通信状況をご確認のうえ、ページを再読み込みしてください。期限テーブルのマイグレーションが未適用の場合は、SQL を実行してください。"}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return <DashboardView data={result.data} />
}
