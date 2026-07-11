import type { Metadata } from "next"
import { getCurrentProfile } from "@/app/actions/auth"
import { getMonthlyReportAction } from "@/app/actions/reports"
import { ReportsView } from "@/components/features/reports/reports-view"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { recentMonthKeys } from "@/lib/reports"

export const metadata: Metadata = {
  title: "月次レポート",
}

type PageProps = {
  searchParams: Promise<{ month?: string }> | { month?: string }
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams)
  const defaultMonth = recentMonthKeys(1)[0] ?? "2026-07"
  const monthKey =
    params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : defaultMonth

  const [result, profile] = await Promise.all([
    getMonthlyReportAction(monthKey),
    getCurrentProfile(),
  ])

  const org = Array.isArray(profile?.organizations)
    ? profile?.organizations[0]
    : profile?.organizations

  if (!result.ok || !result.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">月次レポート</h1>
        </div>
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle />
          <AlertTitle>レポートを取得できませんでした</AlertTitle>
          <AlertDescription>
            {result.error ??
              "Supabase SQL Editor で supabase/migrations/20260711050000_reports.sql を実行してください。"}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <ReportsView data={result.data} facilityName={org?.name} />
  )
}
