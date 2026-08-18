"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { toast } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { CHECK_UI } from "@/lib/copy/check-ui"
import {
  isFindingAddressed,
  sortFindings,
} from "@/lib/check/findings-sort"
import type { Finding, FindingStatus } from "@/types/database"
import { FindingsResultView } from "@/components/features/check/findings-result-view"

/**
 * DB を使わないデモ用。操作はローカル state のみ。
 */
export function DemoFindingsResultView({
  initialFindings,
}: {
  initialFindings: Finding[]
}) {
  const [findings, setFindings] = useState(() => sortFindings(initialFindings))

  const allAddressed = useMemo(
    () =>
      findings.length > 0 &&
      findings.every((f) => isFindingAddressed(f.status)),
    [findings]
  )

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
    <FindingsResultView
      documentId="demo"
      initialFindings={findings}
      initialAllAddressed={false}
      demoActions={apply}
    />
  )
}
