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
import { PURPOSE_SECTIONS } from "@/lib/rule-engine/purpose-sections"
import { AlertCircle, ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "チェック設定",
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
        <AlertTitle>ホームを開けませんでした</AlertTitle>
        <AlertDescription>
          {result.error ??
            "マイグレーション 20260720120000_rule_engine.sql の適用をご確認ください。"}
        </AlertDescription>
      </Alert>
    )
  }

  const d = result.data

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          チェック設定ホーム
        </h1>
        <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
          やりたいことから選んで、監査対策・加算・AI判定の設定を整えられます。
        </p>
      </div>

      {(d.pendingVersionCount > 0 ||
        d.pendingKnowledgeDraftCount > 0 ||
        d.openSyncAlertCount > 0) && (
        <Alert className="rounded-xl border-warning/30 bg-warning/5">
          <AlertCircle className="text-warning" />
          <AlertTitle>確認が必要なことがあります</AlertTitle>
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

      <section className="space-y-4" aria-labelledby="purpose-entry-heading">
        <h2
          id="purpose-entry-heading"
          className="text-xl font-bold text-primary-dark"
        >
          目的から選ぶ
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {PURPOSE_SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <Link
                key={section.id}
                href={section.href}
                className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full rounded-xl shadow-subtle transition-colors group-hover:border-primary/30 group-hover:bg-primary/[0.02]">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <ArrowRight
                        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden
                      />
                    </div>
                    <CardTitle className="text-lg text-primary-dark">
                      {section.label}
                    </CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {section.purpose}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-xl font-bold text-primary-dark">
          いまの状況
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <StatCard
            label="対応自治体（市区町村）"
            value={d.supportedMunicipalityCount}
            hint={`管轄マスタ全体 ${d.jurisdictionCount} 件`}
            href="/admin/rules/municipalities"
          />
        </div>
      </section>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">まず始めるなら</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            監査で確認される項目を整えてから、AI判定ルールを承認するとチェックの根拠がはっきりします。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/admin/rules/audit-items">監査対策を開く</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/admin/rules/pending">承認待ちを確認する</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
