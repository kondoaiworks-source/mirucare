"use client"

import { useState } from "react"
import Link from "next/link"
import { BookOpen, ChevronDown, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CHECK_UI } from "@/lib/copy/check-ui"
import type { AppliedRulesSnapshot } from "@/types/database"
import { cn } from "@/lib/utils"

type AppliedRulesPanelProps = {
  snapshot: AppliedRulesSnapshot | null | undefined
  checkAsOf?: string | null
  /** 運営向けに履歴画面へのリンクを出す */
  showOperatorHistoryLink?: boolean
}

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—"
  const [y, m, d] = isoDate.split("-")
  if (!y || !m || !d) return isoDate
  return `${y}年${Number(m)}月${Number(d)}日`
}

/**
 * チェック結果に「いつの版で見たか」と適用ルール版を表示する。
 */
export function AppliedRulesPanel({
  snapshot,
  checkAsOf,
  showOperatorHistoryLink = false,
}: AppliedRulesPanelProps) {
  const [open, setOpen] = useState(false)
  const asOf = snapshot?.asOf ?? checkAsOf
  const rules = snapshot?.rules ?? []
  const basis = snapshot?.regulatoryBasis ?? []

  if (!asOf && rules.length === 0 && basis.length === 0) {
    return (
      <Card className="rounded-xl border-dashed shadow-subtle">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-primary-dark">
            <History className="size-4 text-primary" aria-hidden />
            {CHECK_UI.appliedRulesTitle}
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">
            {CHECK_UI.appliedRulesMissing}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl shadow-subtle">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base text-primary-dark">
            <History className="size-4 text-primary" aria-hidden />
            {CHECK_UI.appliedRulesTitle}
          </CardTitle>
          <Badge
            variant="outline"
            className="rounded-lg tabular-nums text-primary-dark"
          >
            基準日 {formatDate(asOf)}
          </Badge>
        </div>
        <CardDescription className="text-base leading-relaxed">
          {CHECK_UI.appliedRulesHint(
            rules.length,
            Boolean(snapshot?.truncated)
          )}
        </CardDescription>
        {showOperatorHistoryLink ? (
          <p className="text-sm">
            <Link
              href="/admin/rules/setup"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              運営：ルール版の履歴を開く
            </Link>
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-base font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "適用ルール版を閉じる" : "適用ルール版を表示する"}
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>

        {open ? (
          <div className="space-y-4">
            {rules.length === 0 ? (
              <p className="text-base leading-relaxed text-muted-foreground">
                {CHECK_UI.appliedRulesEmpty}
              </p>
            ) : (
              <ul className="space-y-3">
                {rules.map((r) => (
                  <li
                    key={r.versionId}
                    className="rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">
                        {r.code}
                      </span>
                      <Badge variant="secondary" className="rounded-lg tabular-nums">
                        版 {r.versionNo}
                      </Badge>
                      <Badge variant="outline" className="rounded-lg">
                        {r.severity === "high"
                          ? "高"
                          : r.severity === "low"
                            ? "低"
                            : "中"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-base font-semibold text-primary-dark">
                      {r.title}
                    </p>
                    {r.auditItemTitle ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        カテゴリ: {r.auditItemTitle}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                      適用開始 {formatDate(r.effectiveFrom)}
                      {r.effectiveTo
                        ? ` 〜 ${formatDate(r.effectiveTo)}`
                        : " 〜（終了日なし）"}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {basis.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <BookOpen className="size-4" aria-hidden />
                  {CHECK_UI.regulatoryBasisLabel}
                </p>
                <ul className="space-y-2">
                  {basis.map((b) => (
                    <li
                      key={b.id}
                      className="rounded-lg border border-dashed border-border px-3 py-2 text-base leading-relaxed"
                    >
                      {b.title}
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {[
                          b.year ? `${b.year}年度` : null,
                          b.regionName,
                          b.jurisdictionLevel,
                        ]
                          .filter(Boolean)
                          .join("・")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
