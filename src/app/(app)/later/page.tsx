import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { Clock } from "lucide-react"
import { listLaterFindingsAction } from "@/app/actions/findings"
import { EmptyState } from "@/components/features/empty-state"
import { RiskBadge, type RiskLevel } from "@/components/features/risk-badge"
import { LaterListSkeleton } from "@/components/features/skeletons/page-skeletons"
import { PageHeader } from "@/components/features/layout/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CHECK_UI, annotateTerms } from "@/lib/copy/check-ui"
import { anonymizeText } from "@/lib/privacy/anonymize"
import type { FindingSeverity } from "@/types/database"

export const metadata: Metadata = {
  title: "あとで確認",
}

function toRiskLevel(severity: FindingSeverity): RiskLevel {
  if (severity === "high") return "high"
  if (severity === "low") return "low"
  return "medium"
}

export default function LaterPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={CHECK_UI.laterListTitle}
        description={CHECK_UI.laterListDescription}
      />

      <Suspense fallback={<LaterListSkeleton />}>
        <LaterListContent />
      </Suspense>
    </div>
  )
}

async function LaterListContent() {
  const result = await listLaterFindingsAction()
  const findings = result.ok ? (result.data?.findings ?? []) : []

  if (!result.ok) {
    return (
      <p className="rounded-lg border border-border bg-surface px-4 py-6 text-base text-muted-foreground">
        {result.error ??
          "一覧を取得できませんでした。しばらくしてから再度お試しください。"}
      </p>
    )
  }

  if (findings.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title={CHECK_UI.laterListEmptyTitle}
        description={CHECK_UI.laterListEmptyDescription}
        action={
          <Button asChild size="lg">
            <Link href="/audit-history">監査結果を見る</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm tabular-nums text-muted-foreground">
        {findings.length}件
      </p>
      {findings.map((f) => {
        const doc = Array.isArray(f.documents) ? f.documents[0] : f.documents
        return (
          <Card key={f.id} className="rounded-lg shadow-subtle">
            <CardHeader className="gap-2 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={toRiskLevel(f.severity)} />
                <span className="inline-flex items-center gap-1 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning">
                  <Clock className="size-3.5" aria-hidden />
                  {CHECK_UI.statusLater}
                </span>
              </div>
              <CardTitle className="text-base font-bold leading-snug text-primary-dark">
                {annotateTerms(anonymizeText(f.title).text)}
              </CardTitle>
              <CardDescription className="text-sm">
                {doc?.original_name ?? "書類"}
                {doc?.doc_type ? ` · ${doc.doc_type}` : null}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={`/check/${f.document_id}`}>
                  {CHECK_UI.laterListOpenResult}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
