"use client"

import { BookOpen, GitCompare, HelpCircle } from "lucide-react"
import { CHECK_UI } from "@/lib/copy/check-ui"
import {
  countFindingsByCheckType,
  type FindingCheckTypeFilter,
} from "@/lib/check/check-type"
import { cn } from "@/lib/utils"

type Counts = ReturnType<typeof countFindingsByCheckType>

export function FindingCheckTypeSummary({
  counts,
}: {
  counts: Counts
}) {
  return (
    <section
      className="rounded-xl border border-border bg-surface px-4 py-4"
      aria-labelledby="check-type-summary-heading"
    >
      <h2
        id="check-type-summary-heading"
        className="text-lg font-bold text-primary-dark"
      >
        {CHECK_UI.checkResultsHeading}
      </h2>
      <p className="mt-1 text-base tabular-nums leading-relaxed text-muted-foreground">
        {CHECK_UI.checkResultsTotal(counts.all)}
      </p>
      <ul className="mt-3 space-y-2 text-base">
        <li className="flex items-center gap-2">
          <GitCompare className="size-4 shrink-0 text-primary" aria-hidden />
          <span>{CHECK_UI.checkTypeConsistency}</span>
          <span className="ml-auto font-semibold tabular-nums text-primary-dark">
            {counts.consistency}件
          </span>
        </li>
        <li className="flex items-center gap-2">
          <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />
          <span>{CHECK_UI.checkTypeRule}</span>
          <span className="ml-auto font-semibold tabular-nums text-primary-dark">
            {counts.rule}件
          </span>
        </li>
        {counts.unset > 0 ? (
          <li className="flex items-center gap-2">
            <HelpCircle
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span>{CHECK_UI.checkTypeUnset}</span>
            <span className="ml-auto font-semibold tabular-nums text-muted-foreground">
              {counts.unset}件
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  )
}

export function FindingCheckTypeFilterBar({
  counts,
  value,
  onChange,
}: {
  counts: Counts
  value: FindingCheckTypeFilter
  onChange: (next: FindingCheckTypeFilter) => void
}) {
  const buttons: Array<{
    id: FindingCheckTypeFilter
    label: string
  }> = [
    { id: "all", label: CHECK_UI.filterAll(counts.all) },
    { id: "consistency", label: CHECK_UI.filterConsistency(counts.consistency) },
    { id: "rule", label: CHECK_UI.filterRule(counts.rule) },
  ]
  if (counts.unset > 0) {
    buttons.push({ id: "unset", label: CHECK_UI.filterUnset(counts.unset) })
  }

  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="指摘の分類で絞り込む"
    >
      {buttons.map((btn) => {
        const selected = value === btn.id
        return (
          <button
            key={btn.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "inline-flex min-h-11 items-center rounded-xl border px-3 py-2 text-sm font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/10 text-primary-dark"
                : "border-border bg-background text-muted-foreground hover:bg-surface"
            )}
            onClick={() => onChange(btn.id)}
          >
            {btn.label}
          </button>
        )
      })}
    </div>
  )
}
