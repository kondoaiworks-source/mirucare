"use client"

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Clock,
  ThumbsDown,
} from "lucide-react"
import { toast } from "@/components/ui/sonner"
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
import { anonymizeText } from "@/lib/privacy/anonymize"
import { updateFindingAction } from "@/app/actions/findings"
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
      <span
        className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary"
        title={CHECK_UI.statusFixedHint}
      >
        <Check className="size-3.5" aria-hidden />
        {CHECK_UI.statusFixed}
        <span className="font-normal opacity-80">
          （{CHECK_UI.statusFixedHint}）
        </span>
      </span>
    )
  }
  if (status === "dismissed") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground"
        title={CHECK_UI.statusDismissedHint}
      >
        <ThumbsDown className="size-3.5" aria-hidden />
        {CHECK_UI.statusDismissed}
        <span className="hidden font-normal opacity-80 sm:inline">
          （{CHECK_UI.statusDismissedHint}）
        </span>
      </span>
    )
  }
  return null
}

function FindingCard({
  finding,
  onLocalUpdate,
}: {
  finding: Finding
  onLocalUpdate: (updated: Finding, allAddressed: boolean) => void
}) {
  const router = useRouter()
  const [basisOpen, setBasisOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const isDone = isFindingAddressed(finding.status)
  const showLaterButton = finding.status === "open"
  const showActions = finding.status === "open" || finding.status === "later"

  function run(action: "fixed" | "later" | "dismissed") {
    startTransition(async () => {
      const result = await updateFindingAction({
        findingId: finding.id,
        action,
        feedbackReason:
          action === "dismissed" ? "これは違うと思う" : undefined,
      })
      if (!result.ok) {
        toast.error(result.error ?? "操作に失敗しました。")
        return
      }
      if (action === "fixed") toast.success(CHECK_UI.actionFixedDone)
      if (action === "later") {
        toast.message(CHECK_UI.actionLaterDone, {
          action: {
            label: "あとで確認を見る",
            onClick: () => {
              router.push("/later")
            },
          },
        })
      }
      if (action === "dismissed") toast.message(CHECK_UI.actionDismissDone)
      if (result.data?.finding) {
        onLocalUpdate(result.data.finding, result.data.allAddressed)
      }
    })
  }

  async function copySuggestion() {
    if (!finding.suggestion) return
    try {
      await navigator.clipboard.writeText(
        anonymizeText(finding.suggestion).text
      )
      toast.success(CHECK_UI.copied)
    } catch {
      toast.error("コピーできませんでした。手動で選択してください。")
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
          {annotateTerms(anonymizeText(finding.title).text)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-base leading-relaxed">
        <p>{annotateTerms(anonymizeText(finding.description).text)}</p>

        {finding.basis ? (
          <div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={basisOpen}
              onClick={() => setBasisOpen((v) => !v)}
            >
              【{CHECK_UI.basisLabel}】を表示
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  basisOpen && "rotate-180"
                )}
                aria-hidden
              />
            </button>
            {basisOpen ? (
              <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                {annotateTerms(anonymizeText(finding.basis).text)}
              </p>
            ) : null}
          </div>
        ) : null}

        {finding.suggestion ? (
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-sm font-medium text-primary-dark">
              【{CHECK_UI.suggestionLabel}】
            </p>
            <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">
              {annotateTerms(anonymizeText(finding.suggestion).text)}
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
            disabled={pending}
            onClick={() => run("fixed")}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            {CHECK_UI.actionFixed}
          </Button>
          {showLaterButton ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:flex-1"
              disabled={pending}
              onClick={() => run("later")}
            >
              <Clock className="size-4" aria-hidden />
              {CHECK_UI.actionLater}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:flex-1"
            disabled={pending}
            onClick={() => run("dismissed")}
          >
            <ThumbsDown className="size-4" aria-hidden />
            {CHECK_UI.actionDismiss}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

function FindingSection({
  title,
  count,
  hint,
  children,
}: {
  title: string
  count: number
  hint?: ReactNode
  children: ReactNode
}) {
  if (count === 0) return null
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-bold text-primary-dark">
          {title}
          <span className="ml-2 text-base font-normal tabular-nums text-muted-foreground">
            （{count}件）
          </span>
        </h2>
        {hint}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}

export function FindingsResultView({
  documentId,
  initialFindings,
  initialAllAddressed,
}: {
  documentId: string
  initialFindings: Finding[]
  initialAllAddressed: boolean
}) {
  const router = useRouter()
  const [findings, setFindings] = useState(() => sortFindings(initialFindings))
  const [allAddressed, setAllAddressed] = useState(initialAllAddressed)

  useEffect(() => {
    setFindings(sortFindings(initialFindings))
    setAllAddressed(initialAllAddressed)
  }, [initialFindings, initialAllAddressed])

  const groups = useMemo(() => groupFindingsByStatus(findings), [findings])

  function handleLocalUpdate(updated: Finding, done: boolean) {
    setFindings((prev) =>
      sortFindings(prev.map((f) => (f.id === updated.id ? updated : f)))
    )
    if (done) setAllAddressed(true)
    router.refresh()
  }

  if (allAddressed && findings.length > 0) {
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
      <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {CHECK_UI.anonymityNote}
      </p>
      <p className="text-sm tabular-nums text-muted-foreground">
        {CHECK_UI.remainingLabel(
          groups.open.length,
          groups.later.length,
          findings.length
        )}
        <span className="sr-only">書類 {documentId}</span>
      </p>

      <FindingSection
        title={CHECK_UI.sectionOpen}
        count={groups.open.length}
      >
        {groups.open.map((f) => (
          <FindingCard
            key={f.id}
            finding={f}
            onLocalUpdate={handleLocalUpdate}
          />
        ))}
      </FindingSection>

      <FindingSection
        title={CHECK_UI.sectionLater}
        count={groups.later.length}
        hint={
          <Link
            href="/later"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {CHECK_UI.sectionLaterHint}
          </Link>
        }
      >
        {groups.later.map((f) => (
          <FindingCard
            key={f.id}
            finding={f}
            onLocalUpdate={handleLocalUpdate}
          />
        ))}
      </FindingSection>

      <FindingSection
        title={CHECK_UI.sectionDismissed}
        count={groups.dismissed.length}
      >
        {groups.dismissed.map((f) => (
          <FindingCard
            key={f.id}
            finding={f}
            onLocalUpdate={handleLocalUpdate}
          />
        ))}
      </FindingSection>

      <FindingSection
        title={CHECK_UI.sectionFixed}
        count={groups.fixed.length}
      >
        {groups.fixed.map((f) => (
          <FindingCard
            key={f.id}
            finding={f}
            onLocalUpdate={handleLocalUpdate}
          />
        ))}
      </FindingSection>
    </div>
  )
}
