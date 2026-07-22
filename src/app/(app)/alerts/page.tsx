import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { AlertsView } from "@/components/features/alerts/alerts-view"
import { AlertsSkeleton } from "@/components/features/skeletons/page-skeletons"
import { listDeadlinesAction } from "@/app/actions/deadlines"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/features/empty-state"
import { AlertCircle, Bell } from "lucide-react"
import { BILLING_UI } from "@/lib/plans"

export const metadata: Metadata = {
  title: "アラート",
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<AlertsSkeleton />}>
      <AlertsContent />
    </Suspense>
  )
}

async function AlertsContent() {
  const result = await listDeadlinesAction()

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">期限アラート</h1>
        </div>
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle />
          <AlertTitle>一覧を取得できませんでした</AlertTitle>
          <AlertDescription>
            {result.error ??
              "Supabase SQL Editor で supabase/migrations/20260711040000_deadlines.sql を実行してください。"}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (result.data && !result.data.alertsEnabled) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">期限アラート</h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            同意日・更新期限などの見落とし確認を支援する画面です。
          </p>
        </div>
        <EmptyState
          icon={Bell}
          title={BILLING_UI.alertsLockedTitle}
          description={BILLING_UI.alertsLockedBody}
          action={
            <Button asChild size="lg">
              <Link href="/pricing">{BILLING_UI.upgradeToStandard}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <AlertsView initialDeadlines={result.data?.deadlines ?? []} />
    </div>
  )
}
