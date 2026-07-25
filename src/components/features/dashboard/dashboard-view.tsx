"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileCheck2,
  Info,
  Megaphone,
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
import { HOME_UI } from "@/lib/copy/home-ui"
import { annotateTerms } from "@/lib/copy/check-ui"
import { anonymizeText } from "@/lib/privacy/anonymize"
import type {
  DashboardData,
  DashboardIncompleteDocument,
  DashboardTodayItem,
} from "@/app/actions/deadlines"
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

function documentTodoCopy(doc: DashboardIncompleteDocument): {
  label: string
  href: string
  cta: string
} {
  if (doc.status === "uploaded") {
    return {
      label: DEADLINE_UI.uploadedTodo,
      href: "/check/upload",
      cta: "種類を選ぶ",
    }
  }
  if (doc.status === "checking") {
    return {
      label: DEADLINE_UI.checkingTodo,
      href: `/check/${doc.id}`,
      cta: "結果を見る",
    }
  }
  return {
    label: DEADLINE_UI.reviewedTodo,
    href: `/check/${doc.id}`,
    cta: "続ける",
  }
}

function SectionHeading({
  id,
  icon: Icon,
  title,
  hint,
  badgeCount,
  action,
}: {
  id: string
  icon: typeof Megaphone
  title: string
  hint: string
  badgeCount?: number
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h2
          id={id}
          className="flex flex-wrap items-center gap-2 text-lg font-bold text-primary-dark"
        >
          <Icon className="size-5 shrink-0 text-primary" aria-hidden />
          <span>{title}</span>
          {typeof badgeCount === "number" && badgeCount > 0 ? (
            <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-lg bg-primary px-1.5 text-xs font-bold tabular-nums text-primary-foreground">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          ) : null}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function TodayItemCard({ item }: { item: DashboardTodayItem }) {
  if (item.kind === "document") {
    const todo = documentTodoCopy(item.document)
    return (
      <Card className="rounded-lg shadow-subtle">
        <CardContent className="flex items-center gap-4 py-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileCheck2 className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-warning">{todo.label}</p>
            <p className="truncate text-base font-semibold text-primary-dark">
              {item.document.original_name}
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link href={todo.href}>{todo.cta}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { deadline } = item
  const daysLabel =
    deadline.daysLeft < 0
      ? DEADLINE_UI.daysOverdue(Math.abs(deadline.daysLeft))
      : DEADLINE_UI.daysLeft(deadline.daysLeft)
  const bigNumber =
    deadline.daysLeft < 0 ? Math.abs(deadline.daysLeft) : deadline.daysLeft

  return (
    <Card className="rounded-lg shadow-subtle">
      <CardContent className="flex items-center gap-4 py-4">
        <div className="min-w-[5.5rem] text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {deadline.daysLeft < 0
              ? "超過"
              : deadline.daysLeft === 0
                ? "本日"
                : "残り"}
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold tabular-nums leading-none",
              deadline.daysLeft < 0 ? "text-danger" : "text-primary-dark"
            )}
          >
            {deadline.daysLeft === 0 ? "—" : bigNumber}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {deadline.daysLeft === 0 ? "" : "日"}
          </p>
          <p className="sr-only">{daysLabel}</p>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <DaysBadge daysLeft={deadline.daysLeft} />
            <span className="text-sm text-muted-foreground">{deadline.kind}</span>
          </div>
          <p className="truncate text-base font-semibold text-primary-dark">
            {toPrivacySubject(deadline.subject)}
          </p>
          <p className="text-sm tabular-nums text-muted-foreground">
            期限 {deadline.due_date}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/alerts">確認する</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function DashboardView({ data }: { data: DashboardData }) {
  const todayItems = data.todayItems ?? []
  const announcements = data.announcements ?? []
  const announcementCount = data.announcementCount ?? announcements.length

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      {/* 1. アプリ説明（3行） */}
      <section className="space-y-4" aria-labelledby="home-summary">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1
              id="home-summary"
              className="text-2xl font-bold text-primary-dark md:text-3xl"
            >
              {HOME_UI.title}
            </h1>
            <div className="mt-3 space-y-2 text-base leading-relaxed text-muted-foreground">
              {HOME_UI.summaryLines.map((line) => (
                <p key={line} className="flex gap-2">
                  <Info
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span>{line}</span>
                </p>
              ))}
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/audit/operations">{HOME_UI.ctaOperations}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Link href="/check/upload">{HOME_UI.ctaUpload}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. お知らせ（直近3件） */}
      <section className="space-y-3" aria-labelledby="home-announcements">
        <SectionHeading
          id="home-announcements"
          icon={Megaphone}
          title={HOME_UI.announcementsTitle}
          hint={HOME_UI.announcementsHint}
          badgeCount={announcementCount}
          action={
            <Button asChild variant="ghost" className="min-h-11 px-3">
              <Link href="/announcements">{HOME_UI.announcementsAll}</Link>
            </Button>
          }
        />
        {announcements.length === 0 ? (
          <Card className="rounded-lg shadow-subtle">
            <CardContent className="flex items-center gap-3 py-6 text-base leading-relaxed text-muted-foreground">
              <CheckCircle2
                className="size-6 shrink-0 text-primary"
                aria-hidden
              />
              {HOME_UI.announcementsEmpty}
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {announcements.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link
                  href="/announcements"
                  className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="rounded-lg shadow-subtle transition-colors hover:bg-muted/40">
                    <CardHeader className="gap-1 py-4">
                      <CardTitle className="line-clamp-1 text-base font-bold text-primary-dark">
                        {a.title}
                      </CardTitle>
                      <CardDescription className="text-sm tabular-nums">
                        {new Date(a.created_at).toLocaleString("ja-JP", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. 今日やること（最大3件） */}
      <section className="space-y-3" aria-labelledby="home-today">
        <SectionHeading
          id="home-today"
          icon={Clock}
          title={HOME_UI.todayTitle}
          hint={HOME_UI.todayHint}
        />
        {todayItems.length === 0 ? (
          <Card className="rounded-lg shadow-subtle">
            <CardContent className="flex items-center gap-3 py-6 text-base leading-relaxed text-muted-foreground">
              <CheckCircle2
                className="size-6 shrink-0 text-primary"
                aria-hidden
              />
              {HOME_UI.todayEmpty}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {todayItems.map((item) => (
              <TodayItemCard
                key={
                  item.kind === "document"
                    ? `doc-${item.document.id}`
                    : `dl-${item.deadline.id}`
                }
                item={item}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. 最近の指摘（最大20件） */}
      <section className="space-y-3" aria-labelledby="home-recent">
        <SectionHeading
          id="home-recent"
          icon={AlertTriangle}
          title={HOME_UI.recentTitle}
          hint={HOME_UI.recentHint}
        />
        {data.recentFindings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-base text-muted-foreground">
            {HOME_UI.recentEmpty}
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
                        {annotateTerms(anonymizeText(f.title).text)}
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
