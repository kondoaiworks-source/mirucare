"use client"

import Link from "next/link"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RiskBadge, type RiskLevel } from "@/components/features/risk-badge"
import { DEADLINE_UI, toPrivacySubject } from "@/lib/deadlines"
import { annotateTerms } from "@/lib/copy/check-ui"
import type { DashboardData } from "@/app/actions/deadlines"
import type { FindingSeverity } from "@/types/database"
import { cn } from "@/lib/utils"

function toRiskLevel(severity: FindingSeverity): RiskLevel {
  if (severity === "high") return "high"
  if (severity === "low") return "low"
  return "medium"
}

function DaysBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft < 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1 text-sm font-medium text-danger"
        role="status"
      >
        <AlertTriangle className="size-4" aria-hidden />
        超過
      </span>
    )
  }
  if (daysLeft <= 7) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning"
        role="status"
      >
        <Clock className="size-4" aria-hidden />
        まもなく
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
      <CalendarClock className="size-4" aria-hidden />
      予定
    </span>
  )
}

export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
            ダッシュボード
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            今日の期限と、今週のチェック状況を確認できます。
          </p>
        </div>
        <Button asChild size="lg" className="w-full shrink-0 sm:w-auto">
          <Link href="/check/upload">{DEADLINE_UI.ctaCheck}</Link>
        </Button>
      </div>

      {/* 1. 今日やること — 最初に目に入る */}
      <section className="space-y-3" aria-labelledby="today-todos">
        <h2
          id="today-todos"
          className="text-lg font-bold text-primary-dark"
        >
          {DEADLINE_UI.todayTitle}
        </h2>

        {data.todayTodos.length === 0 ? (
          <Card className="rounded-lg shadow-subtle">
            <CardContent className="flex items-center gap-3 py-6 text-base leading-relaxed text-muted-foreground">
              <CheckCircle2 className="size-6 shrink-0 text-primary" aria-hidden />
              {DEADLINE_UI.todayEmpty}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {data.todayTodos.map((item) => {
              const daysLabel =
                item.daysLeft < 0
                  ? DEADLINE_UI.daysOverdue(Math.abs(item.daysLeft))
                  : DEADLINE_UI.daysLeft(item.daysLeft)
              const bigNumber =
                item.daysLeft < 0
                  ? Math.abs(item.daysLeft)
                  : item.daysLeft
              return (
              <Card key={item.id} className="rounded-lg shadow-subtle">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="min-w-[6rem] text-center">
                    <p className="text-sm font-medium text-muted-foreground">
                      {item.daysLeft < 0 ? "超過" : item.daysLeft === 0 ? "本日" : "残り"}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-4xl font-bold tabular-nums leading-none",
                        item.daysLeft < 0 ? "text-danger" : "text-primary-dark"
                      )}
                    >
                      {item.daysLeft === 0 ? "—" : bigNumber}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.daysLeft === 0 ? "" : "日"}
                    </p>
                    <p className="sr-only">{daysLabel}</p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <DaysBadge daysLeft={item.daysLeft} />
                      <span className="text-sm text-muted-foreground">
                        {item.kind}
                      </span>
                    </div>
                    <p className="truncate text-base font-semibold text-primary-dark">
                      {toPrivacySubject(item.subject)}
                    </p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      期限 {item.due_date}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="shrink-0">
                    <Link href="/alerts">詳細</Link>
                  </Button>
                </CardContent>
              </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* 2. 今週のチェック状況 */}
      <section className="space-y-3" aria-labelledby="weekly-stats">
        <h2
          id="weekly-stats"
          className="text-lg font-bold text-primary-dark"
        >
          {DEADLINE_UI.weeklyTitle}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              [DEADLINE_UI.weeklyUploads, data.weekly.uploads],
              [DEADLINE_UI.weeklyFindings, data.weekly.findings],
              [DEADLINE_UI.weeklyFixed, data.weekly.fixed],
            ] as const
          ).map(([label, value]) => (
            <Card key={label} className="rounded-lg shadow-subtle">
              <CardContent className="px-3 py-5 text-center">
                <p className="text-3xl font-bold tabular-nums text-primary-dark md:text-4xl">
                  {value}
                </p>
                <p className="mt-2 text-sm leading-snug text-muted-foreground">
                  {label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. 最近の指摘 */}
      <section className="space-y-3" aria-labelledby="recent-findings">
        <h2
          id="recent-findings"
          className="text-lg font-bold text-primary-dark"
        >
          {DEADLINE_UI.recentFindings}
        </h2>
        {data.recentFindings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-base text-muted-foreground">
            {DEADLINE_UI.recentEmpty}
          </p>
        ) : (
          <div className="grid gap-3">
            {data.recentFindings.map((f) => {
              const doc = Array.isArray(f.documents)
                ? f.documents[0]
                : f.documents
              return (
                <Link
                  key={f.id}
                  href={`/check/${f.document_id}`}
                  className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="rounded-lg shadow-subtle transition-colors hover:bg-muted/40">
                    <CardHeader className="gap-2 pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <RiskBadge level={toRiskLevel(f.severity)} />
                      </div>
                      <CardTitle className="text-base font-bold leading-snug">
                        {annotateTerms(f.title)}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {doc?.original_name ?? "書類"}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
