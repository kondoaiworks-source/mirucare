import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { REPORT_UI } from "@/lib/reports"
import { cn } from "@/lib/utils"

type ReportSummaryProps = {
  riskCount: number
  fixedCount: number
  className?: string
}

export function ReportSummary({
  riskCount,
  fixedCount,
  className,
}: ReportSummaryProps) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        className
      )}
    >
      <div className="rounded-lg border border-border bg-card p-5 shadow-subtle">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <AlertTriangle
            className={cn(
              "size-5",
              riskCount === 0 ? "text-primary" : "text-danger"
            )}
            aria-hidden
          />
          {REPORT_UI.riskLabel}
        </div>
        <p
          className={cn(
            "mt-3 text-5xl font-bold tabular-nums leading-none",
            riskCount === 0 ? "text-primary" : "text-danger"
          )}
        >
          {riskCount}
          <span className="ml-1 text-lg font-semibold">件</span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {REPORT_UI.riskHint}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-subtle">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CheckCircle2 className="size-5 text-primary" aria-hidden />
          {REPORT_UI.fixedLabel}
        </div>
        <p className="mt-3 text-5xl font-bold tabular-nums leading-none text-primary-dark">
          {fixedCount}
          <span className="ml-1 text-lg font-semibold">件</span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {REPORT_UI.fixedHint}
        </p>
      </div>
    </div>
  )
}
