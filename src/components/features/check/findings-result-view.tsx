"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CHECK_UI } from "@/lib/copy/check-ui"
import {
  groupFindingsByStatus,
  sortFindings,
} from "@/lib/check/findings-sort"
import {
  countFindingsByCheckType,
  filterFindingsByCheckType,
  type FindingCheckTypeFilter,
} from "@/lib/check/check-type"
import type { Finding } from "@/types/database"
import { FindingCard } from "@/components/features/check/finding-card"
import {
  FindingCheckTypeFilterBar,
  FindingCheckTypeSummary,
} from "@/components/features/check/finding-check-type-bar"

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
  demoActions,
}: {
  documentId: string
  initialFindings: Finding[]
  initialAllAddressed: boolean
  demoActions?: (id: string, action: "fixed" | "later" | "dismissed") => void
}) {
  const router = useRouter()
  const [findings, setFindings] = useState(() => sortFindings(initialFindings))
  const [allAddressed, setAllAddressed] = useState(initialAllAddressed)
  const [checkFilter, setCheckFilter] = useState<FindingCheckTypeFilter>("all")

  useEffect(() => {
    setFindings(sortFindings(initialFindings))
    setAllAddressed(initialAllAddressed)
  }, [initialFindings, initialAllAddressed])

  const typeCounts = useMemo(
    () => countFindingsByCheckType(findings),
    [findings]
  )
  const visible = useMemo(
    () => filterFindingsByCheckType(findings, checkFilter),
    [findings, checkFilter]
  )
  const groups = useMemo(() => groupFindingsByStatus(visible), [visible])

  function handleLocalUpdate(updated: Finding, done: boolean) {
    setFindings((prev) =>
      sortFindings(
        prev.map((f) =>
          f.id === updated.id
            ? { ...updated, sourceFileName: f.sourceFileName }
            : f
        )
      )
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
      <FindingCheckTypeSummary counts={typeCounts} />
      <FindingCheckTypeFilterBar
        counts={typeCounts}
        value={checkFilter}
        onChange={setCheckFilter}
      />

      <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {CHECK_UI.anonymityNote}
      </p>
      <p className="text-sm tabular-nums text-muted-foreground">
        {CHECK_UI.remainingLabel(
          groupFindingsByStatus(findings).open.length,
          groupFindingsByStatus(findings).later.length,
          findings.length
        )}
        <span className="sr-only">書類 {documentId}</span>
      </p>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-base text-muted-foreground">
          {CHECK_UI.filterEmpty}
        </p>
      ) : null}

      <FindingSection title={CHECK_UI.sectionOpen} count={groups.open.length}>
        {groups.open.map((f) => (
          <FindingCard
            key={f.id}
            finding={f}
            onLocalUpdate={handleLocalUpdate}
            localActions={
              demoActions
                ? (action) => demoActions(f.id, action)
                : undefined
            }
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
            localActions={
              demoActions
                ? (action) => demoActions(f.id, action)
                : undefined
            }
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
            localActions={
              demoActions
                ? (action) => demoActions(f.id, action)
                : undefined
            }
          />
        ))}
      </FindingSection>

      <FindingSection title={CHECK_UI.sectionFixed} count={groups.fixed.length}>
        {groups.fixed.map((f) => (
          <FindingCard
            key={f.id}
            finding={f}
            onLocalUpdate={handleLocalUpdate}
            localActions={
              demoActions
                ? (action) => demoActions(f.id, action)
                : undefined
            }
          />
        ))}
      </FindingSection>
    </div>
  )
}
