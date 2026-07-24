"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Check,
  ChevronDown,
  Copy,
  Clock,
  ThumbsDown,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RiskBadge, type RiskLevel } from "@/components/features/risk-badge"
import { CHECK_UI, annotateTerms } from "@/lib/copy/check-ui"
import {
  groupFindingsByStatus,
  isFindingAddressed,
  sortFindings,
} from "@/lib/check/findings-sort"
import type { Finding, FindingSeverity, FindingStatus } from "@/types/database"
import { cn } from "@/lib/utils"

function toRiskLevel(severity: FindingSeverity): RiskLevel {
  if (severity === "high") return "high"
  if (severity === "low") return "low"
  return "medium"
}

function StatusBadge({ status }: { status: FindingStatus }) {
  if (status === "later") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning">
        <Clock className="size-3.5" aria-hidden />
        {CHECK_UI.statusLater}
      </span>
    )
  }
  if (status === "fixed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
        <Check className="size-3.5" aria-hidden />
        {CHECK_UI.statusFixed}
      </span>
    )
  }
  if (status === "dismissed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
        <ThumbsDown className="size-3.5" aria-hidden />
        {CHECK_UI.statusDismissed}
      </span>
    )
  }
  return null
}

/**
 * DB を使わないデモ用。操作はローカル state のみ。
 */
export function DemoFindingsResultView({
  initialFindings,
}: {
  initialFindings: Finding[]
}) {
  const [findings, setFindings] = useState(() => sortFindings(initialFindings))

  const groups = useMemo(() => groupFindingsByStatus(findings), [findings])
  const allAddressed =
    findings.length > 0 && findings.every((f) => isFindingAddressed(f.status))

  function apply(id: string, action: "fixed" | "later" | "dismissed") {
    const nextStatus: FindingStatus =
      action === "fixed" ? "fixed" : action === "dismissed" ? "dismissed" : "later"
    setFindings((prev) =>
      sortFindings(
        prev.map((f) => (f.id === id ? { ...f, status: nextStatus } : f))
      )
    )
    if (action === "fixed") toast.success(CHECK_UI.actionFixedDone)
    if (action === "later") toast.message(CHECK_UI.actionLaterDone)
    if (action === "dismissed") toast.message(CHECK_UI.actionDismissDone)
  }

  if (allAddressed) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div
          className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden
        >
          <Check className="size-8" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold text-primary-dark">
          {CHECK_UI.completeTitle}
        </h2>
        <p className="max-w-md text-base leading-relaxed text-muted-foreground">
          {CHECK_UI.completeBody}
        </p>
        <Button asChild size="lg" className="mt-2">
          <Link href="/audit-history">{CHECK_UI.backToList}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="text-sm tabular-nums text-muted-foreground">
        {CHECK_UI.remainingLabel(
          groups.open.length,
          groups.later.length,
          findings.length
        )}
        （デモ）
      </p>

      {(
        [
          ["open", CHECK_UI.sectionOpen, groups.open],
          ["later", CHECK_UI.sectionLater, groups.later],
          ["dismissed", CHECK_UI.sectionDismissed, groups.dismissed],
          ["fixed", CHECK_UI.sectionFixed, groups.fixed],
        ] as const
      ).map(([key, title, list]) =>
        list.length === 0 ? null : (
          <section key={key} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-bold text-primary-dark">
                {title}
                <span className="ml-2 text-base font-normal tabular-nums text-muted-foreground">
                  （{list.length}件）
                </span>
              </h2>
              {key === "later" ? (
                <Link
                  href="/later"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {CHECK_UI.sectionLaterHint}
                </Link>
              ) : null}
            </div>
            <div className="grid gap-4">
              {list.map((finding) => (
                <DemoCard
                  key={finding.id}
                  finding={finding}
                  onAction={apply}
                />
              ))}
            </div>
          </section>
        )
      )}
    </div>
  )
}

function DemoCard({
  finding,
  onAction,
}: {
  finding: Finding
  onAction: (id: string, action: "fixed" | "later" | "dismissed") => void
}) {
  const [basisOpen, setBasisOpen] = useState(false)
  const isDone = isFindingAddressed(finding.status)
  const showActions = finding.status === "open" || finding.status === "later"
  const showLaterButton = finding.status === "open"

  async function copySuggestion() {
    if (!finding.suggestion) return
    try {
      await navigator.clipboard.writeText(finding.suggestion)
      toast.success(CHECK_UI.copied)
    } catch {
      toast.error("コピーできませんでした。")
    }
  }

  return (
    <Card className={cn("rounded-lg shadow-subtle", isDone && "opacity-70")}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={toRiskLevel(finding.severity)} />
          <StatusBadge status={finding.status} />
          {finding.is_fallback ? (
            <span className="text-sm text-muted-foreground">自動確認不可</span>
          ) : null}
        </div>
        <CardTitle className="text-lg font-bold leading-snug text-primary-dark">
          {annotateTerms(finding.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-base leading-relaxed">
        <p>{annotateTerms(finding.description)}</p>
        {finding.basis ? (
          <div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              aria-expanded={basisOpen}
              onClick={() => setBasisOpen((v) => !v)}
            >
              【{CHECK_UI.basisLabel}】を表示
              <ChevronDown
                className={cn("size-4", basisOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            {basisOpen ? (
              <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-muted-foreground">
                {annotateTerms(finding.basis)}
              </p>
            ) : null}
          </div>
        ) : null}
        {finding.suggestion ? (
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-sm font-medium text-primary-dark">
              【{CHECK_UI.suggestionLabel}】
            </p>
            <p className="mt-2 whitespace-pre-wrap">
              {annotateTerms(finding.suggestion)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={copySuggestion}
            >
              <Copy className="size-4" aria-hidden />
              {CHECK_UI.copySuggestion}
            </Button>
          </div>
        ) : null}
      </CardContent>
      {showActions ? (
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="w-full sm:flex-1"
            onClick={() => onAction(finding.id, "fixed")}
          >
            <Check className="size-4" aria-hidden />
            {CHECK_UI.actionFixed}
          </Button>
          {showLaterButton ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:flex-1"
              onClick={() => onAction(finding.id, "later")}
            >
              <Clock className="size-4" aria-hidden />
              {CHECK_UI.actionLater}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:flex-1"
            onClick={() => onAction(finding.id, "dismissed")}
          >
            <ThumbsDown className="size-4" aria-hidden />
            {CHECK_UI.actionDismiss}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}
