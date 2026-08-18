"use client"

import { useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Copy,
  GitCompare,
  HelpCircle,
  Loader2,
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
import { isFindingAddressed } from "@/lib/check/findings-sort"
import { displayFindingCheckType } from "@/lib/check/check-type"
import type { Finding, FindingSeverity, FindingStatus } from "@/types/database"
import { cn } from "@/lib/utils"

function toRiskLevel(severity: FindingSeverity): RiskLevel {
  if (severity === "high") return "high"
  if (severity === "low") return "low"
  return "medium"
}

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—"
  const [y, m, d] = isoDate.split("-")
  if (!y || !m || !d) return isoDate
  return `${y}年${Number(m)}月${Number(d)}日`
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

function CheckTypeBadge({ finding }: { finding: Finding }) {
  const kind = displayFindingCheckType(finding)
  if (kind === "consistency") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary-dark"
        title={CHECK_UI.checkTypeConsistencyHint}
      >
        <GitCompare className="size-3.5" aria-hidden />
        {CHECK_UI.checkTypeConsistency}
      </span>
    )
  }
  if (kind === "rule") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary-dark"
        title={CHECK_UI.checkTypeRuleHint}
      >
        <BookOpen className="size-3.5" aria-hidden />
        {CHECK_UI.checkTypeRule}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground"
      title={CHECK_UI.checkTypeUnsetHint}
    >
      <HelpCircle className="size-3.5" aria-hidden />
      {CHECK_UI.checkTypeUnset}
    </span>
  )
}

function Disclosure({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        【{label}】を表示
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-2 whitespace-pre-wrap rounded-lg bg-surface px-3 py-2 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function FindingCard({
  finding,
  onLocalUpdate,
  localActions,
}: {
  finding: Finding
  onLocalUpdate?: (updated: Finding, allAddressed: boolean) => void
  /** デモ用。指定時は API を呼ばない */
  localActions?: (action: "fixed" | "later" | "dismissed") => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const isDone = isFindingAddressed(finding.status)
  const showLaterButton = finding.status === "open"
  const showActions = finding.status === "open" || finding.status === "later"
  const checkType = displayFindingCheckType(finding)
  const comparison =
    finding.check_meta?.comparison && finding.check_meta.comparison.length > 0
      ? finding.check_meta.comparison
          .map((item) =>
            [item.source, item.detail].filter(Boolean).join("\n")
          )
          .join("\n\n")
      : finding.basis
  const hasAppliedRule =
    Boolean(finding.rule_code) ||
    Boolean(finding.rule_title) ||
    Boolean(finding.rule_version_id) ||
    Boolean(finding.audit_item) ||
    Boolean(finding.finding_check_as_of)

  function run(action: "fixed" | "later" | "dismissed") {
    if (localActions) {
      localActions(action)
      return
    }
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
      if (result.data?.finding && onLocalUpdate) {
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
          <CheckTypeBadge finding={finding} />
          {finding.source_kind === "alignment" ? (
            <span className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary-dark">
              {CHECK_UI.alignmentBadge}
            </span>
          ) : null}
          <StatusBadge status={finding.status} />
          {finding.is_fallback ? (
            <span className="text-sm text-muted-foreground">自動確認不可</span>
          ) : null}
        </div>
        {finding.sourceFileName ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {finding.sourceFileName}
          </p>
        ) : null}
        <CardTitle className="text-lg font-bold leading-snug text-primary-dark">
          {annotateTerms(anonymizeText(finding.title).text)}
        </CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          チェック種別：
          {checkType === "consistency"
            ? CHECK_UI.checkTypeConsistency
            : checkType === "rule"
              ? CHECK_UI.checkTypeRule
              : CHECK_UI.checkTypeUnset}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-base leading-relaxed">
        <p>{annotateTerms(anonymizeText(finding.description).text)}</p>

        {checkType === "consistency" && comparison ? (
          <Disclosure label={CHECK_UI.comparisonLabel}>
            {annotateTerms(anonymizeText(comparison).text)}
          </Disclosure>
        ) : null}

        {checkType === "rule" && hasAppliedRule ? (
          <Disclosure label={CHECK_UI.appliedRuleLabel}>
            <dl className="space-y-2">
              {finding.rule_code ? (
                <div>
                  <dt className="font-medium text-primary-dark">
                    {CHECK_UI.ruleCodeLabel}
                  </dt>
                  <dd className="font-mono tabular-nums">{finding.rule_code}</dd>
                </div>
              ) : null}
              {finding.rule_title ? (
                <div>
                  <dt className="font-medium text-primary-dark">
                    {CHECK_UI.ruleNameLabel}
                  </dt>
                  <dd>{finding.rule_title}</dd>
                </div>
              ) : null}
              {finding.rule_version_no != null ? (
                <div>
                  <dt className="font-medium text-primary-dark">
                    {CHECK_UI.ruleVersionLabel}
                  </dt>
                  <dd className="tabular-nums">版 {finding.rule_version_no}</dd>
                </div>
              ) : finding.rule_version_id ? (
                <div>
                  <dt className="font-medium text-primary-dark">
                    {CHECK_UI.ruleVersionLabel}
                  </dt>
                  <dd className="break-all font-mono text-xs">
                    {finding.rule_version_id}
                  </dd>
                </div>
              ) : null}
              {finding.audit_item ? (
                <div>
                  <dt className="font-medium text-primary-dark">
                    {CHECK_UI.auditItemLabel}
                  </dt>
                  <dd>{finding.audit_item}</dd>
                </div>
              ) : null}
              {finding.finding_check_as_of ? (
                <div>
                  <dt className="font-medium text-primary-dark">
                    {CHECK_UI.checkAsOfLabel}
                  </dt>
                  <dd className="tabular-nums">
                    {formatDate(finding.finding_check_as_of)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Disclosure>
        ) : null}

        {checkType === "rule" && finding.basis ? (
          <Disclosure label={CHECK_UI.ruleBasisLabel}>
            {annotateTerms(anonymizeText(finding.basis).text)}
          </Disclosure>
        ) : null}

        {checkType !== "consistency" &&
        checkType !== "rule" &&
        finding.basis ? (
          <Disclosure label={CHECK_UI.basisLabel}>
            {annotateTerms(anonymizeText(finding.basis).text)}
          </Disclosure>
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
