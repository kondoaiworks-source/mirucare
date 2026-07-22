import type { Metadata } from "next"
import { getMonthlyHubDataAction } from "@/app/actions/monthly-hub"
import { MonthlyHubView } from "@/components/features/monthly/monthly-hub-view"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "月末の確認",
}

export default async function MonthlyHubPage() {
  const result = await getMonthlyHubDataAction()

  if (!result.ok || !result.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">月末の確認</h1>
        </div>
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle />
          <AlertTitle>月末の確認を開けませんでした</AlertTitle>
          <AlertDescription>
            {result.error ??
              "日報・勤怠データの取得に失敗しました。マイグレーションの適用をご確認ください。"}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return <MonthlyHubView data={result.data} />
}
