import Link from "next/link"
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Hourglass,
  Pencil,
} from "lucide-react"
import type { CityRulebookCheckRule } from "@/app/actions/city-rulebook"
import { CityRulebookSection } from "@/components/features/admin/rules/city-rulebook-section"
import { ManualCheckRuleForm } from "@/components/features/admin/rules/manual-check-rule-form"
import { RULE_SCOPE_LABEL } from "@/lib/rule-engine/city-rule-scope"
import type { AuditItemCategory } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const CATEGORY_ORDER: Array<AuditItemCategory | "未分類"> = [
  "契約",
  "計画",
  "記録",
  "人員",
  "加算",
  "請求",
  "その他",
  "未分類",
]

type Props = {
  citySlug: string
  approved: CityRulebookCheckRule[]
  pending: CityRulebookCheckRule[]
}

/**
 * 了承済み＝この市のチェックルール（チェックに使う物差し）。
 * ジャンル（監査項目カテゴリ）ごとにまとめ、根拠・文言修正へのリンクを出す。
 */
export function CityRulebookCheckRulesPanel({
  citySlug,
  approved,
  pending,
}: Props) {
  const grouped = groupByCategory(approved)

  return (
    <CityRulebookSection
      headingId="check-rules-heading"
      icon={<ClipboardList className="size-5" aria-hidden />}
      title="チェックルール"
      countLabel={`（了承済み ${approved.length}件）`}
      description="チェックの際に適用されるルールの一覧です"
      action={
        pending.length > 0 ? (
          <Button asChild className="min-h-11">
            <Link href="/admin/rules/pending">
              ルール管理で了承する（{pending.length}件）
            </Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link
              href="/admin/rules/pending#history"
              className="text-primary underline-offset-4 hover:underline"
            >
              更新履歴
            </Link>
          </p>
        )
      }
    >
      {pending.length > 0 ? (
        <Card className="rounded-xl border-warning/30 bg-warning/5 shadow-subtle">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-primary-dark">
              <Hourglass className="size-4" aria-hidden />
              了承前の案（まだチェックには使いません）
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              ルール管理で了承すると、下の了承済みに入ります。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {pending.slice(0, 5).map((r) => (
                <RuleRow
                  key={r.versionId}
                  rule={r}
                  citySlug={citySlug}
                  pending
                />
              ))}
            </ul>
            {pending.length > 5 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                ほか {pending.length - 5}件はルール管理で確認できます。
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <details className="rounded-xl border border-border bg-muted/30 px-4 py-3">
        <summary className="cursor-pointer text-base font-semibold text-primary-dark outline-none focus-visible:ring-2 focus-visible:ring-ring">
          了承済みルールを表示する（{approved.length}件）
        </summary>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          {approved.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-base text-muted-foreground">
              まだ了承済みがありません。下の「自治体ルール設定」で国・県・市の公開情報PDFを登録し「判定ルール案を生成」するか、手入力で1件追加してから、ルール管理で了承してください。
            </p>
          ) : (
            CATEGORY_ORDER.map((category) => {
              const rules = grouped.get(category) ?? []
              if (rules.length === 0) return null
              return (
                <details
                  key={category}
                  className="rounded-xl border border-border bg-white px-4 py-3"
                >
                  <summary className="cursor-pointer text-base font-semibold text-primary-dark outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {category}
                    <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                      （{rules.length}件）
                    </span>
                  </summary>
                  <ul className="mt-4 space-y-2 border-t border-border pt-4">
                    {rules.map((r) => (
                      <RuleRow
                        key={r.versionId}
                        rule={r}
                        citySlug={citySlug}
                      />
                    ))}
                  </ul>
                </details>
              )
            })
          )}
        </div>
      </details>

      <details className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <summary className="cursor-pointer text-base font-semibold text-primary-dark outline-none focus-visible:ring-2 focus-visible:ring-ring">
          手入力で判定ルールを1件追加する
        </summary>
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="text-base leading-relaxed text-muted-foreground">
            AI案が出せないときや、急ぎで1件足したいときに使います。登録すると必ずルール管理に載り、了承するまでチェックには使いません。
          </p>
          <ManualCheckRuleForm />
        </div>
      </details>
    </CityRulebookSection>
  )
}

function groupByCategory(
  rules: CityRulebookCheckRule[]
): Map<AuditItemCategory | "未分類", CityRulebookCheckRule[]> {
  const map = new Map<AuditItemCategory | "未分類", CityRulebookCheckRule[]>()
  for (const category of CATEGORY_ORDER) {
    map.set(category, [])
  }
  for (const rule of rules) {
    const key = rule.category ?? "未分類"
    const list = map.get(key) ?? []
    list.push(rule)
    map.set(key, list)
  }
  return map
}

function RuleRow({
  rule,
  citySlug,
  pending = false,
}: {
  rule: CityRulebookCheckRule
  citySlug: string
  pending?: boolean
}) {
  const hasEvidenceBody =
    Boolean(rule.evidenceSummary?.trim()) || rule.evidenceQuotes.length > 0
  const hasSourceLink = Boolean(rule.sourceDocumentUrl)

  return (
    <li>
      <Card className="rounded-xl shadow-subtle">
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {pending ? (
              <Badge variant="outline" className="rounded-md">
                了承待ち
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="rounded-md border-primary/30 text-primary"
              >
                <CheckCircle2 className="mr-1 size-3.5" aria-hidden />
                了承済み
              </Badge>
            )}
            {rule.category ? (
              <Badge variant="secondary" className="rounded-md">
                {rule.category}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="rounded-md">
              {RULE_SCOPE_LABEL[rule.scopeKind]}
            </Badge>
            <Badge variant="outline" className="rounded-md">
              {rule.severity === "high"
                ? "緊急寄り"
                : rule.severity === "mid"
                  ? "要改善寄り"
                  : "推奨寄り"}
            </Badge>
            <span className="text-sm text-muted-foreground tabular-nums">
              {rule.code} / v{rule.versionNo}
            </span>
          </div>
          <p className="font-semibold text-primary-dark">{rule.title}</p>
          {rule.auditItemTitle ? (
            <p className="text-sm text-muted-foreground">
              監査項目: {rule.auditItemTitle}
            </p>
          ) : null}
          <p className="text-base leading-relaxed text-muted-foreground line-clamp-3">
            {rule.guidanceText || "（案内文なし）"}
          </p>
          {rule.sourceDocumentTitle ? (
            <p className="text-sm text-muted-foreground line-clamp-1">
              根拠資料: {rule.sourceDocumentTitle}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            {hasSourceLink ? (
              <Button asChild variant="outline" size="sm" className="min-h-11">
                <a
                  href={rule.sourceDocumentUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <BookOpen className="size-4" aria-hidden />
                  原本の根拠を開く
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              </Button>
            ) : null}
            {!pending ? (
              <Button asChild variant="outline" size="sm" className="min-h-11">
                <Link
                  href={`/admin/rules/ai-rules?editRule=${rule.ruleId}&fromCity=${citySlug}`}
                >
                  <Pencil className="size-4" aria-hidden />
                  文言を修正する
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="min-h-11">
                <Link href="/admin/rules/pending">ルール管理で確認する</Link>
              </Button>
            )}
          </div>

          {hasEvidenceBody ? (
            <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-primary-dark outline-none focus-visible:ring-2 focus-visible:ring-ring">
                根拠の要約・引用を表示する
              </summary>
              <div className="mt-2 space-y-2 border-t border-border pt-2 text-base leading-relaxed text-muted-foreground">
                {rule.evidenceSummary ? <p>{rule.evidenceSummary}</p> : null}
                {rule.evidenceQuotes.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {rule.evidenceQuotes.map((q, i) => (
                      <li key={`${rule.versionId}-q-${i}`}>「{q}」</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>
          ) : null}

          {!hasSourceLink && !hasEvidenceBody ? (
            <p className="text-sm text-muted-foreground">
              原本URL・根拠引用は未登録です。自治体ルール設定の資料をご確認ください。
            </p>
          ) : null}
        </CardContent>
      </Card>
    </li>
  )
}
