import { BookOpen, GitCompare, HelpCircle, Info } from "lucide-react"
import { CHECK_UI } from "@/lib/copy/check-ui"
import type { CheckRunSummary } from "@/lib/check/check-run-summary"
import { cn } from "@/lib/utils"

type Props = {
  summary: CheckRunSummary
  className?: string
}

/**
 * チェック結果の2行サマリ。
 * 件数は色だけでなくラベルと数字で出す。
 */
export function CheckRunSummaryPanel({ summary, className }: Props) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5",
        className
      )}
      aria-labelledby="check-run-summary-heading"
    >
      <div>
        <h2
          id="check-run-summary-heading"
          className="text-lg font-semibold text-primary-dark"
        >
          {CHECK_UI.checkRunHeading}
        </h2>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          {CHECK_UI.checkRunHint}
        </p>
      </div>

      <ul className="space-y-3">
        <li className="rounded-xl border border-border bg-muted/20 px-4 py-3">
          <div className="flex items-start gap-2">
            <GitCompare
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-base font-semibold text-primary-dark">
                {CHECK_UI.consistencyCheckLabel}
              </p>
              <p
                className="text-2xl font-bold tabular-nums leading-snug text-primary-dark"
                aria-label={`${CHECK_UI.consistencyCheckLabel} ${CHECK_UI.consistencyCheckLine(summary.consistencyCheckedCount, summary.consistencyFindingCount)}`}
              >
                {CHECK_UI.consistencyCheckLine(
                  summary.consistencyCheckedCount,
                  summary.consistencyFindingCount
                )}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {CHECK_UI.checkTypeConsistencyHint}
              </p>
            </div>
          </div>
        </li>

        <li className="rounded-xl border border-border bg-muted/20 px-4 py-3">
          <div className="flex items-start gap-2">
            <BookOpen
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-base font-semibold text-primary-dark">
                {CHECK_UI.ruleCheckLabel}
              </p>
              {summary.rulebookRuleCount == null ? (
                <>
                  <p
                    className="text-2xl font-bold tabular-nums leading-snug text-primary-dark"
                    aria-label={`${CHECK_UI.ruleCheckLabel} ${CHECK_UI.ruleCheckLineWithoutCount(summary.ruleFindingCount)}`}
                  >
                    {CHECK_UI.ruleCheckLineWithoutCount(summary.ruleFindingCount)}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {CHECK_UI.ruleCheckCountMissing}
                  </p>
                </>
              ) : (
                <>
                  <p
                    className="text-2xl font-bold tabular-nums leading-snug text-primary-dark"
                    aria-label={`${CHECK_UI.ruleCheckLabel} ${CHECK_UI.ruleCheckLine(summary.rulebookRuleCount, summary.ruleFindingCount)}`}
                  >
                    {CHECK_UI.ruleCheckLine(
                      summary.rulebookRuleCount,
                      summary.ruleFindingCount
                    )}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {CHECK_UI.ruleCheckCompareHint}
                  </p>
                  {summary.ruleFindingCount === 0 ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {CHECK_UI.ruleCheckZeroHint}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </li>
      </ul>

      {summary.truncated ? (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {CHECK_UI.ruleCheckTruncatedHint}
        </p>
      ) : null}

      {summary.unsetFindingCount > 0 ? (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <HelpCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {CHECK_UI.checkTypeUnset} {summary.unsetFindingCount}件。
          {CHECK_UI.checkTypeUnsetHint}
        </p>
      ) : null}
    </section>
  )
}
