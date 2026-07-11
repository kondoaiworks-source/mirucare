"use client"

import Link from "next/link"
import { Lock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReportSummary } from "@/components/features/reports/report-summary"
import { MarkdownView } from "@/components/features/reports/markdown-view"
import { BreakdownBars } from "@/components/features/reports/breakdown-bars"
import {
  REPORT_UI,
  SAMPLE_BREAKDOWN,
  SAMPLE_REPORT_MD,
} from "@/lib/reports"

export function PlanUpgradePreview() {
  return (
    <div className="space-y-6">
      <div className="relative rounded-lg border border-border">
        <div
          className="pointer-events-none select-none space-y-6 p-4 blur-[6px] sm:p-6"
          aria-hidden
        >
          <ReportSummary riskCount={0} fixedCount={12} />
          <div>
            <h2 className="mb-3 text-lg font-bold text-primary-dark">
              {REPORT_UI.analysisTitle}
            </h2>
            <MarkdownView content={SAMPLE_REPORT_MD} />
          </div>
          <div>
            <h2 className="mb-3 text-lg font-bold text-primary-dark">
              {REPORT_UI.breakdownTitle}
            </h2>
            <BreakdownBars items={SAMPLE_BREAKDOWN} />
          </div>
        </div>

        <div className="absolute inset-0 flex items-start justify-center overflow-y-auto bg-background/70 px-4 py-8 sm:items-center">
          <div className="my-auto w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-subtle">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="size-6" aria-hidden />
            </div>
            <h2 className="text-lg font-bold text-primary-dark">
              {REPORT_UI.upgradeTitle}
            </h2>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {REPORT_UI.upgradeDescription}
            </p>
            <Button asChild size="lg" className="mt-5 w-full sm:w-auto">
              <Link href="/pricing">
                <Sparkles className="size-5" aria-hidden />
                {REPORT_UI.upgradeCta}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
