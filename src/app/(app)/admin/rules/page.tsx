import type { Metadata } from "next"
import Link from "next/link"
import { getRulesDashboardAction } from "@/app/actions/rule-engine"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "ルールエンジン管理",
}

function StatCard(props: {
  label: string
  value: number
  hint?: string
  href?: string
  warn?: boolean
}) {
  const inner = (
    <Card className="rounded-xl shadow-subtle">
      <CardHeader className="pb-2">
        <CardDescription className="text-base">{props.label}</CardDescription>
        <CardTitle
          className={`text-3xl font-bold tabular-nums ${
            props.warn ? "text-danger" : "text-primary-dark"
          }`}
        >
          {props.value}
        </CardTitle>
      </CardHeader>
      {props.hint ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{props.hint}</p>
        </CardContent>
      ) : null}
    </Card>
  )
  if (props.href) {
    return (
      <Link href={props.href} className="block transition-opacity hover:opacity-90">
        {inner}
      </Link>
    )
  }
  return inner
}

export default async function RulesDashboardPage() {
  const result = await getRulesDashboardAction()

  if (!result.ok || !result.data) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle />
        <AlertTitle>ダッシュボードを開けませんでした</AlertTitle>
        <AlertDescription>
          {result.error ??
            "マイグレーション 20260720120000_rule_engine.sql の適用をご確認ください。"}
        </AlertDescription>
      </Alert>
    )
  }

  const d = result.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          ダッシュボード
        </h1>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          マスタールールの件数と、確認が必要なキューです（Wチェック支援の根拠マスタ）。
        </p>
      </div>

      {(d.pendingVersionCount > 0 ||
        d.pendingKnowledgeDraftCount > 0 ||
        d.openSyncAlertCount > 0) && (
        <Alert className="rounded-xl border-warning/30 bg-warning/5">
          <AlertCircle className="text-warning" />
          <AlertTitle>要対応があります</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-2 pt-2">
            {d.pendingVersionCount > 0 ? (
              <Badge variant="destructive" className="rounded-lg tabular-nums">
                ルール承認待ち {d.pendingVersionCount}
              </Badge>
            ) : null}
            {d.pendingKnowledgeDraftCount > 0 ? (
              <Badge variant="destructive" className="rounded-lg tabular-nums">
                マニュアル差分 {d.pendingKnowledgeDraftCount}
              </Badge>
            ) : null}
            {d.openSyncAlertCount > 0 ? (
              <Badge variant="outline" className="rounded-lg tabular-nums">
                同期アラート {d.openSyncAlertCount}
              </Badge>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="対応自治体（市区町村）"
          value={d.supportedMunicipalityCount}
          hint={`管轄マスタ全体 ${d.jurisdictionCount} 件`}
          href="/admin/rules/municipalities"
        />
        <StatCard
          label="ルールセット"
          value={d.ruleSetCount}
          href="/admin/rules/audit-items"
        />
        <StatCard
          label="監査項目"
          value={d.auditItemCount}
          href="/admin/rules/audit-items"
        />
        <StatCard
          label="AI判定ルール"
          value={d.aiRuleCount}
          href="/admin/rules/ai-rules"
        />
        <StatCard
          label="承認待ち（ルール版）"
          value={d.pendingVersionCount}
          href="/admin/rules/pending"
          warn={d.pendingVersionCount > 0}
        />
        <StatCard
          label="マニュアル差分（未承認）"
          value={d.pendingKnowledgeDraftCount}
          href="/admin/document-changes"
          warn={d.pendingKnowledgeDraftCount > 0}
        />
        <StatCard
          label="同期アラート（未解消）"
          value={d.openSyncAlertCount}
          href="/admin/rules/jobs"
          warn={d.openSyncAlertCount > 0}
        />
      </div>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">次に進む</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            監査項目を登録し、AI判定ルールの版を承認すると、将来のチェック根拠になります。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/admin/rules/audit-items">監査項目を登録する</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/admin/rules/pending">承認待ちを確認する</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
