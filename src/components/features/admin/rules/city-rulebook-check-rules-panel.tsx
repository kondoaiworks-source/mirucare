import Link from "next/link"
import { CheckCircle2, ClipboardList, Hourglass } from "lucide-react"
import type { CityRulebookCheckRule } from "@/app/actions/city-rulebook"
import { CityRulebookSection } from "@/components/features/admin/rules/city-rulebook-section"
import { RULE_SCOPE_LABEL } from "@/lib/rule-engine/city-rule-scope"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Props = {
  approved: CityRulebookCheckRule[]
  pending: CityRulebookCheckRule[]
}

/**
 * 了承済み＝この市のチェックルール（チェックに使う物差し）。
 */
export function CityRulebookCheckRulesPanel({
  approved,
  pending,
}: Props) {
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
              承認待ちで了承する（{pending.length}件）
            </Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link
              href="/admin/rules/history"
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
              承認待ちで了承すると、下の了承済みに入ります。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {pending.slice(0, 5).map((r) => (
                <RuleRow key={r.versionId} rule={r} pending />
              ))}
            </ul>
            {pending.length > 5 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                ほか {pending.length - 5}件は承認待ち画面で確認できます。
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <details className="rounded-xl border border-border bg-muted/30 px-4 py-3">
        <summary className="cursor-pointer text-base font-semibold text-primary-dark outline-none focus-visible:ring-2 focus-visible:ring-ring">
          了承済みルールを表示する（{approved.length}件）
        </summary>
        <div className="mt-4 border-t border-border pt-4">
          {approved.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-base text-muted-foreground">
              まだ了承済みがありません。自治体ルール設定で行政資料から「判定ルール案を生成」し、承認待ちで了承してください。
            </p>
          ) : (
            <ul className="space-y-2">
              {approved.map((r) => (
                <RuleRow key={r.versionId} rule={r} />
              ))}
            </ul>
          )}
        </div>
      </details>
    </CityRulebookSection>
  )
}

function RuleRow({
  rule,
  pending = false,
}: {
  rule: CityRulebookCheckRule
  pending?: boolean
}) {
  return (
    <li>
      <Card className="rounded-xl shadow-subtle">
        <CardContent className="space-y-2 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {pending ? (
              <Badge variant="outline" className="rounded-md">
                承認待ち
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
          <p className="text-base leading-relaxed text-muted-foreground line-clamp-3">
            {rule.guidanceText || "（案内文なし）"}
          </p>
          {rule.sourceDocumentTitle ? (
            <p className="text-sm text-muted-foreground line-clamp-1">
              根拠資料: {rule.sourceDocumentTitle}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </li>
  )
}
