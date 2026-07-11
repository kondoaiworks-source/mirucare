"use client"

import { useRouter } from "next/navigation"
import { FileClock } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/features/empty-state"
import { ReportSummary } from "@/components/features/reports/report-summary"
import { MarkdownView } from "@/components/features/reports/markdown-view"
import { BreakdownBars } from "@/components/features/reports/breakdown-bars"
import { PdfDownloadButton } from "@/components/features/reports/pdf-download-button"
import { PlanUpgradePreview } from "@/components/features/reports/plan-upgrade-preview"
import { ReportPrintDocument } from "@/components/features/reports/report-print-document"
import type { MonthlyReportView } from "@/app/actions/reports"
import {
  formatMonthJa,
  recentMonthKeys,
  REPORT_DISCLAIMER,
  REPORT_UI,
} from "@/lib/reports"

type ReportsViewProps = {
  data: MonthlyReportView
  facilityName?: string
}

export function ReportsView({ data, facilityName }: ReportsViewProps) {
  const router = useRouter()
  const months = recentMonthKeys(12)

  const onMonthChange = (value: string) => {
    router.push(`/reports?month=${value}`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          {REPORT_UI.title}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {REPORT_UI.description}
        </p>
      </div>

      <div className="no-print space-y-2">
        <Label htmlFor="report-month">{REPORT_UI.monthLabel}</Label>
        <Select value={data.monthKey} onValueChange={onMonthChange}>
          <SelectTrigger id="report-month" className="w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((key) => (
              <SelectItem key={key} value={key}>
                {formatMonthJa(key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!data.isPremium ? (
        <PlanUpgradePreview />
      ) : !data.report ? (
        <EmptyState
          icon={FileClock}
          title={REPORT_UI.emptyTitle}
          description={REPORT_UI.emptyDescription}
        />
      ) : (
        <>
          <div className="no-print space-y-8">
            <section aria-labelledby="report-summary-heading">
              <h2 id="report-summary-heading" className="sr-only">
                {formatMonthJa(data.monthKey)}のサマリー
              </h2>
              <ReportSummary
                riskCount={data.report.risk_count}
                fixedCount={data.report.fixed_count}
              />
            </section>

            <section aria-labelledby="report-analysis-heading">
              <h2
                id="report-analysis-heading"
                className="text-lg font-bold text-primary-dark"
              >
                {REPORT_UI.analysisTitle}
              </h2>
              <p className="mt-1 mb-4 text-sm leading-relaxed text-muted-foreground">
                {REPORT_UI.analysisHint}
              </p>
              <div className="rounded-lg border border-border bg-card p-5 shadow-subtle sm:p-6">
                <MarkdownView content={data.report.summary_md} />
              </div>
            </section>

            <section aria-labelledby="report-breakdown-heading">
              <h2
                id="report-breakdown-heading"
                className="text-lg font-bold text-primary-dark"
              >
                {REPORT_UI.breakdownTitle}
              </h2>
              <p className="mt-1 mb-4 text-sm leading-relaxed text-muted-foreground">
                {REPORT_UI.breakdownHint}
              </p>
              <div className="rounded-lg border border-border bg-card p-5 shadow-subtle sm:p-6">
                <BreakdownBars items={data.breakdown} />
              </div>
            </section>

            <PdfDownloadButton />
          </div>

          {/* 印刷専用レイアウト（画面では非表示） */}
          <ReportPrintDocument
            monthKey={data.monthKey}
            facilityName={facilityName}
            riskCount={data.report.risk_count}
            fixedCount={data.report.fixed_count}
            summaryMd={data.report.summary_md}
            breakdown={data.breakdown}
            disclaimer={REPORT_DISCLAIMER}
          />
        </>
      )}
    </div>
  )
}
