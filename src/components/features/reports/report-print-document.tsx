import { ReportSummary } from "@/components/features/reports/report-summary"
import { MarkdownView } from "@/components/features/reports/markdown-view"
import { BreakdownBars } from "@/components/features/reports/breakdown-bars"
import {
  formatMonthJa,
  REPORT_UI,
  type SeverityBreakdownItem,
} from "@/lib/reports"

type ReportPrintDocumentProps = {
  monthKey: string
  facilityName?: string
  riskCount: number
  fixedCount: number
  summaryMd: string
  breakdown: SeverityBreakdownItem[]
  disclaimer: string
}

/** 画面非表示・印刷時のみ表示する A4 向けドキュメント */
export function ReportPrintDocument({
  monthKey,
  facilityName,
  riskCount,
  fixedCount,
  summaryMd,
  breakdown,
  disclaimer,
}: ReportPrintDocumentProps) {
  return (
    <div className="report-print-root hidden">
      <header className="mb-6 border-b border-border pb-4">
        <p className="text-sm text-muted-foreground">監査のミカタ 月次レポート</p>
        <h1 className="mt-1 text-2xl font-bold text-primary-dark">
          {formatMonthJa(monthKey)}
        </h1>
        {facilityName ? (
          <p className="mt-1 text-base text-foreground">{facilityName}</p>
        ) : null}
      </header>

      <section className="mb-6">
        <ReportSummary riskCount={riskCount} fixedCount={fixedCount} />
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-3 text-lg font-bold text-primary-dark">
          {REPORT_UI.analysisTitle}
        </h2>
        <MarkdownView content={summaryMd} />
      </section>

      <section className="mb-8 break-inside-avoid">
        <h2 className="mb-3 text-lg font-bold text-primary-dark">
          {REPORT_UI.breakdownTitle}
        </h2>
        <BreakdownBars items={breakdown} />
      </section>

      <footer className="report-print-footer mt-auto border-t border-border pt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {disclaimer}
        </p>
      </footer>
    </div>
  )
}
