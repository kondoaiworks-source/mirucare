"use client"

import { CHECK_UI } from "@/lib/copy/check-ui"
import {
  countFindingsByCheckType,
  type FindingCheckTypeFilter,
} from "@/lib/check/check-type"
import { cn } from "@/lib/utils"

type Counts = ReturnType<typeof countFindingsByCheckType>

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
