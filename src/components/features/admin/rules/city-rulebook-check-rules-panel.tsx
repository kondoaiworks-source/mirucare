import Link from "next/link"
import { CheckCircle2, ClipboardList, Hourglass } from "lucide-react"
import type { CityRulebookCheckRule } from "@/app/actions/city-rulebook"
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
  cityName: string
  approved: CityRulebookCheckRule[]
  pending: CityRulebookCheckRule[]
}

/**
 * 了承済み＝この市のチェック用ルールブック中身。承認待ち案も併記。
 */
export function CityRulebookCheckRulesPanel({
  cityName,
  approved,
  pending,
}: Props) {
  return (
    <section className="space-y-4" aria-labelledby="check-rules-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="check-rules-heading"
            className="flex items-center gap-2 text-xl font-bold text-primary-dark"
          >
            <ClipboardList className="size-5 text-primary" aria-hidden />
            チェック用の中身（了承済み判定ルール）
          </h2>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            {cityName}
            で書類チェックに使う物差しです。国・県の共有分と、この市固有の了承分をまとめています。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/admin/rules/pending">承認待ちを開く</Link>
          </Button>
          <Button asChild variant="ghost" className="min-h-11">
            <Link href="/admin/rules/history">更新履歴</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-md tabular-nums">
          了承済み {approved.length}件
        </Badge>
        <Badge variant="outline" className="rounded-md tabular-nums">
          承認待ちの案 {pending.length}件
        </Badge>
      </div>

      {pending.length > 0 ? (
        <Card className="rounded-xl border-warning/30 bg-warning/5 shadow-subtle">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-primary-dark">
              <Hourglass className="size-4" aria-hidden />
              了承前の判定ルール案
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              まだチェックには使われません。承認待ちで了承すると、下の「了承済み」に入ります。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {pending.slice(0, 8).map((r) => (
                <RuleRow key={r.versionId} rule={r} pending />
              ))}
            </ul>
            {pending.length > 8 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                ほか {pending.length - 8}件は承認待ち画面で確認できます。
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {approved.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-base text-muted-foreground">
          まだ了承済みの判定ルールがありません。行政資料の「判定ルール案を生成する」→承認待ちで了承すると、ここに表示されます。
        </p>
      ) : (
        <ul className="space-y-2">
          {approved.map((r) => (
            <RuleRow key={r.versionId} rule={r} />
          ))}
        </ul>
      )}
    </section>
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
          {rule.sourceDocumentTitle || rule.changeSummary ? (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {rule.sourceDocumentTitle
                ? `根拠資料: ${rule.sourceDocumentTitle}`
                : null}
              {rule.sourceDocumentTitle && rule.changeSummary ? " ／ " : null}
              {rule.changeSummary
                ? rule.changeSummary.split("\n")[0]
                : null}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </li>
  )
}
