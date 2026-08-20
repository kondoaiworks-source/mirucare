import { BookPlus, Check, Circle, Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import type { EvidenceCoverage } from "@/lib/rule-engine/evidence-coverage"
import { cn } from "@/lib/utils"

type Props = {
  coverage: EvidenceCoverage
  composeHref: string
}

/**
 * 根拠情報ページのカバー率。根拠カテゴリと資料名・URLで統一する。
 */
export function EvidenceCategoryCoverageSection({
  coverage,
  composeHref,
}: Props) {
  const tone =
    coverage.categoryPercent >= 100
      ? "ok"
      : coverage.categoryPercent >= 50
        ? "mid"
        : "low"

  return (
    <section
      className={cn(
        "space-y-4 rounded-xl border bg-card p-4 shadow-subtle sm:p-5",
        tone === "ok" && "border-primary/30",
        tone === "mid" && "border-accent/40",
        tone === "low" && "border-border"
      )}
      aria-labelledby="evidence-category-coverage-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="evidence-category-coverage-heading"
            className="text-lg font-semibold text-primary-dark"
          >
            {RULES_UI.coverageRate}
          </h2>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            {RULES_UI.evidenceCategory}のうち、資料を置いた割合です。カバー率を上げるために、以下の情報追加をご確認ください。合否の保証ではありません。
          </p>
        </div>
        <p
          className={cn(
            "text-4xl font-bold tabular-nums leading-none",
            tone === "mid" ? "text-accent" : "text-primary-dark"
          )}
          aria-label={`${RULES_UI.coverageRate}${coverage.categoryPercent}パーセント`}
        >
          {coverage.categoryPercent}
          <span className="ml-1 text-xl font-semibold">%</span>
        </p>
      </div>

      <p className="text-base tabular-nums text-muted-foreground">
        登録済み {coverage.categories.length - coverage.recommendedCategories.length}
        ／{coverage.categories.length} カテゴリ
      </p>

      <ul className="space-y-3">
        {coverage.categories.map((cat) => (
          <li
            key={cat.category}
            className="space-y-3 rounded-xl border border-border p-4"
          >
            <div className="flex min-h-11 flex-wrap items-center gap-2">
              {cat.count > 0 ? (
                <Check className="size-5 shrink-0 text-primary" aria-hidden />
              ) : (
                <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <p className="min-w-0 flex-1 text-base font-semibold text-primary-dark">
                {RULES_UI.evidenceCategory}：{cat.label}
              </p>
              <Badge variant="outline" className="rounded-md">
                {cat.count > 0 ? `登録済み ${cat.count}件` : "未登録"}
              </Badge>
            </div>

            {cat.sources.length > 0 ? (
              <ul className="space-y-2">
                {cat.sources.map((source) => (
                  <li
                    key={source.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-primary-dark">
                        {source.title}
                      </p>
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-sm text-muted-foreground underline-offset-4 hover:underline"
                        >
                          {source.url}
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">URL未設定</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" className="min-h-11">
                        <a href={`#source-${source.id}`}>
                          <Pencil className="size-4" aria-hidden />
                          修正する
                        </a>
                      </Button>
                      <Button asChild variant="outline" className="min-h-11">
                        <a href={composeHref}>
                          <BookPlus className="size-4" aria-hidden />
                          {RULES_UI.addToRulebook}
                        </a>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-muted-foreground">
                このカテゴリの資料はまだありません。下の国・県・市から追加すると、カバー率が上がります。
              </p>
            )}
          </li>
        ))}
      </ul>

      {coverage.uncategorizedSources.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-dashed p-4">
          <p className="text-base font-semibold text-primary-dark">
            未分類の資料
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            根拠カテゴリを付けると、カバー率に入ります。
          </p>
          <ul className="space-y-2">
            {coverage.uncategorizedSources.map((source) => (
              <li
                key={source.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="min-w-0 flex-1 font-medium text-primary-dark">
                  {source.title}
                </span>
                <Button asChild variant="outline" className="min-h-11">
                  <a href={`#source-${source.id}`}>
                    <Pencil className="size-4" aria-hidden />
                    修正する
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
