import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentProfile } from "@/app/actions/auth"
import { listReportsAdminAction } from "@/app/actions/reports"
import { AdminReportsForm } from "@/components/features/reports/admin-reports-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { REPORT_UI } from "@/lib/reports"

export const metadata: Metadata = {
  title: "月次レポート管理",
}

export default async function AdminReportsPage() {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect("/login")
  }

  if (profile.role !== "admin") {
    redirect("/reports")
  }

  const result = await listReportsAdminAction()

  if (!result.ok || !result.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            {REPORT_UI.adminTitle}
          </h1>
        </div>
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle />
          <AlertTitle>一覧を取得できませんでした</AlertTitle>
          <AlertDescription>
            {result.error ??
              "Supabase SQL Editor で supabase/migrations/20260711050000_reports.sql を実行してください。"}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            {REPORT_UI.adminTitle}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {REPORT_UI.adminDescription}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/reports">利用者画面を見る</Link>
        </Button>
      </div>

      <AdminReportsForm initialReports={result.data.reports} />
    </div>
  )
}
