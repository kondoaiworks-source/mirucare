import type { Metadata } from "next"
import Link from "next/link"
import { Clock } from "lucide-react"
import { listLaterFindingsAction } from "@/app/actions/findings"
import { EmptyState } from "@/components/features/empty-state"
import { RiskBadge, type RiskLevel } from "@/components/features/risk-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CHECK_UI, annotateTerms } from "@/lib/copy/check-ui"
import type { FindingSeverity } from "@/types/database"

export const metadata: Metadata = {
  title: "あとで確認",
}

function toRiskLevel(severity: FindingSeverity): RiskLevel {
  if (severity === "high") return "high"
  if (severity === "low") return "low"
  return "medium"
}

export default async function LaterPage() {
  const result = await listLaterFindingsAction()
  const findings = result.ok ? (result.data?.findings ?? []) : []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">
          {CHECK_UI.laterListTitle}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {CHECK_UI.laterListDescription}
        </p>
      </div>

      {!result.ok ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-6 text-base text-muted-foreground">
          {result.error ??
            "一覧を取得できませんでした。しばらくしてから再度お試しください。"}
        </p>
      ) : null}

      {result.ok && findings.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={CHECK_UI.laterListEmptyTitle}
          description={CHECK_UI.laterListEmptyDescription}
          action={
            <Button asChild size="lg">
              <Link href="/documents">書類一覧を見る</Link>
            </Button>
          }
        />
      ) : null}

      {findings.length > 0 ? (
        <div className="grid gap-3">
          <p className="text-sm tabular-nums text-muted-foreground">
            {findings.length}件
          </p>
          {findings.map((f) => {
            const doc = Array.isArray(f.documents)
              ? f.documents[0]
              : f.documents
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
                    {annotateTerms(f.title)}
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
      ) : null}
    </div>
  )
}
