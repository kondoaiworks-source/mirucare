import { Check, Circle, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import type { EvidenceCoverage } from "@/lib/rule-engine/evidence-coverage"
import { cn } from "@/lib/utils"

type Props = {
  coverage: Pick<
    EvidenceCoverage,
    "percent" | "nationalPrefectureCount" | "cityCount" | "layers"
  >
  /** ルール件数など、下書き画面用の補足 */
  ruleCount?: number
  sharedRuleCount?: number
  cityRuleCount?: number
  pendingCount?: number
  className?: string
}

/**
 * 根拠情報のカバー率。色だけに頼らず、数値と層ラベルを併記する。
 */
export function EvidenceCoveragePanel({
  coverage,
  ruleCount,
  sharedRuleCount,
  cityRuleCount,
  pendingCount,
  className,
}: Props) {
  const tone =
    coverage.percent >= 100
      ? "ok"
      : coverage.percent >= 67
        ? "mid"
        : "low"

  return (
    <section
      className={cn(
        "space-y-4 rounded-xl border bg-card p-4 shadow-subtle sm:p-5",
        tone === "ok" && "border-primary/30",
        tone === "mid" && "border-accent/40",
        tone === "low" && "border-border",
        className
      )}
      aria-labelledby="evidence-coverage-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="evidence-coverage-heading"
            className="text-lg font-semibold text-primary-dark"
          >
            {RULES_UI.coverageRate}
          </h2>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            国・県・市の読むPDFを置いた割合です。監査に必要な根拠を登録できているか、目視でご確認ください。合否の保証ではありません。
          </p>
        </div>
        <p
          className={cn(
            "text-4xl font-bold tabular-nums leading-none",
            tone === "ok" && "text-primary-dark",
            tone === "mid" && "text-accent",
            tone === "low" && "text-primary-dark"
          )}
          aria-label={`${RULES_UI.coverageRate}${coverage.percent}パーセント`}
        >
          {coverage.percent}
          <span className="ml-1 text-xl font-semibold">%</span>
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <dt className="text-sm text-muted-foreground">参照資料数（国・県）</dt>
          <dd className="text-2xl font-bold tabular-nums text-primary-dark">
            {coverage.nationalPrefectureCount}
            <span className="ml-1 text-base font-semibold">件</span>
          </dd>
        </div>
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <dt className="text-sm text-muted-foreground">参照資料数（市区町村）</dt>
          <dd className="text-2xl font-bold tabular-nums text-primary-dark">
            {coverage.cityCount}
            <span className="ml-1 text-base font-semibold">件</span>
          </dd>
        </div>
        {ruleCount != null ? (
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <dt className="text-sm text-muted-foreground">現在のルール数</dt>
            <dd className="text-2xl font-bold tabular-nums text-primary-dark">
              {ruleCount}
              <span className="ml-1 text-base font-semibold">件</span>
            </dd>
          </div>
        ) : null}
        {sharedRuleCount != null && cityRuleCount != null ? (
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <dt className="text-sm text-muted-foreground">ルール構成</dt>
            <dd className="text-base font-semibold leading-relaxed text-primary-dark">
              国・県 {sharedRuleCount}件／市区町村 {cityRuleCount}件
            </dd>
          </div>
        ) : null}
      </dl>

      {pendingCount != null ? (
        <p className="text-base leading-relaxed text-muted-foreground">
          ※「保存」待ち：
          <span className="ml-1 font-bold tabular-nums text-primary-dark">
            {pendingCount}件
          </span>
        </p>
      ) : null}

      <ul className="grid gap-2 sm:grid-cols-3">
        {coverage.layers.map((layer) => (
          <li
            key={layer.layer}
            className="flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2"
          >
            {layer.filled ? (
              <Check className="size-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-primary-dark">
                {layer.label}
              </span>
              <span className="block text-sm tabular-nums text-muted-foreground">
                {layer.filled
                  ? `読むPDF ${layer.pdfCount}件`
                  : "まだありません"}
              </span>
            </span>
            <Badge variant="outline" className="rounded-md">
              {layer.filled ? "登録済み" : "未登録"}
            </Badge>
          </li>
        ))}
      </ul>

      {coverage.percent < 100 ? (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          足りない層の公式PDF直リンクを置くと、カバー率が上がります。
        </p>
      ) : null}
    </section>
  )
}
