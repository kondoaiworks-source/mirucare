"use client"

import Link from "next/link"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  Megaphone,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { RiskBadge, type RiskLevel } from "@/components/features/risk-badge"
import { SectionCard } from "@/components/features/layout/section-card"
import { PageHeader } from "@/components/features/layout/page-header"
import { DEADLINE_UI, toPrivacySubject } from "@/lib/deadlines"
import { OPS_HOME_UI } from "@/lib/copy/home-ui"
import { annotateTerms } from "@/lib/copy/check-ui"
import { anonymizeText } from "@/lib/privacy/anonymize"
import type {
  DashboardData,
  DashboardIncompleteDocument,
  DashboardTodayItem,
} from "@/app/actions/deadlines"
import type { AppAnnouncement, FindingSeverity } from "@/types/database"
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

function KindBadge({ announcement }: { announcement: AppAnnouncement }) {
  const isFacility = Boolean(announcement.organization_id)
  return (
    <span className="rounded-lg border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {isFacility ? OPS_HOME_UI.kindFacility : OPS_HOME_UI.kindRuleUpdate}
    </span>
  )
}

function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" size="sm" className="min-h-11 gap-1">
      <Link href={href}>
        {label}
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </Button>
  )
}

function TodayItemCard({ item }: { item: DashboardTodayItem }) {
  if (item.kind === "document") {
    const todo = documentTodoCopy(item.document)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileCheck2 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium text-warning">{todo.label}</p>
          <p className="truncate text-base font-semibold text-primary-dark">
            {item.document.original_name}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="min-h-11 shrink-0">
          <Link href={todo.href}>{todo.cta}</Link>
        </Button>
      </div>
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
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3">
      <div className="min-w-[4.5rem] text-center">
        <p className="text-xs text-muted-foreground">
          {deadline.daysLeft < 0
            ? "超過"
            : deadline.daysLeft === 0
              ? "本日"
              : "残り"}
        </p>
        <p
          className={cn(
            "text-2xl font-bold tabular-nums leading-none",
            deadline.daysLeft < 0 ? "text-danger" : "text-primary-dark"
          )}
        >
          {deadline.daysLeft === 0 ? "—" : bigNumber}
        </p>
        <p className="sr-only">{daysLabel}</p>
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <DaysBadge daysLeft={deadline.daysLeft} />
          <span className="text-sm text-muted-foreground">{deadline.kind}</span>
        </div>
        <p className="truncate text-base font-semibold text-primary-dark">
          {toPrivacySubject(deadline.subject)}
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="min-h-11 shrink-0">
        <Link href="/alerts">確認する</Link>
      </Button>
    </div>
  )
}

export function DashboardView({ data }: { data: DashboardData }) {
  const todayItems = data.todayItems ?? []
  const announcements = data.announcements ?? []
  const announcementCount = data.announcementCount ?? announcements.length
  const canPost = data.canPostAnnouncement

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={OPS_HOME_UI.title}
        action={
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/check/upload">
              <Upload className="size-4" aria-hidden />
              {OPS_HOME_UI.ctaUpload}
            </Link>
          </Button>
        }
      />

      <SectionCard
        icon={Megaphone}
        title={OPS_HOME_UI.announcementsTitle}
        description={OPS_HOME_UI.announcementsHint}
        badge={
          announcementCount > 0 ? (
            <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-lg bg-primary px-1.5 text-xs font-bold tabular-nums text-primary-foreground">
              {announcementCount > 99 ? "99+" : announcementCount}
            </span>
          ) : null
        }
        action={
          <div className="flex flex-wrap gap-2">
            {canPost ? (
              <Button asChild variant="outline" size="sm" className="min-h-11">
                <Link href="/announcements#post">
                  {OPS_HOME_UI.announcementsPost}
                </Link>
              </Button>
            ) : null}
            <ViewAllLink
              href="/announcements"
              label={OPS_HOME_UI.announcementsAll}
            />
          </div>
        }
      >
        {announcements.length === 0 ? (
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
            {OPS_HOME_UI.announcementsEmpty}
          </p>
        ) : (
          <ul className="space-y-2">
            {announcements.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link
                  href="/announcements"
                  className="block rounded-lg border border-border bg-surface px-3 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <KindBadge announcement={a} />
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("ja-JP", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-base font-semibold text-primary-dark">
                    {a.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        icon={Clock}
        title={OPS_HOME_UI.todayTitle}
        description={OPS_HOME_UI.todayHint}
        action={
          <ViewAllLink href="/audit-history" label={OPS_HOME_UI.todayAll} />
        }
      >
        {todayItems.length === 0 ? (
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
            {OPS_HOME_UI.todayEmpty}
          </p>
        ) : (
          <div className="grid gap-2">
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
      </SectionCard>

      <SectionCard
        icon={AlertTriangle}
        title={OPS_HOME_UI.recentTitle}
        description={OPS_HOME_UI.recentHint}
        action={
          <ViewAllLink href="/audit-history" label={OPS_HOME_UI.recentAll} />
        }
      >
        {data.recentFindings.length === 0 ? (
          <p className="text-base text-muted-foreground">
            {OPS_HOME_UI.recentEmpty}
          </p>
        ) : (
          <div className="grid gap-2">
            {data.recentFindings.map((f) => {
              const doc = Array.isArray(f.documents)
                ? f.documents[0]
                : f.documents
              return (
                <Link
                  key={f.id}
                  href={`/check/${f.document_id}`}
                  className="block rounded-lg border border-border bg-surface px-3 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <RiskBadge level={toRiskLevel(f.severity)} />
                  </div>
                  <p className="text-base font-bold leading-snug text-primary-dark">
                    {annotateTerms(anonymizeText(f.title).text)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {doc?.original_name ?? "書類"}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
