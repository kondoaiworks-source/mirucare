import type { Metadata } from "next"
import Link from "next/link"
import { getRulesDashboardAction } from "@/app/actions/rule-engine"
import { SetupReadinessPanel } from "@/components/features/admin/setup-readiness-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PURPOSE_SECTIONS } from "@/lib/rule-engine/purpose-sections"
import { buildSetupReadiness } from "@/lib/rule-engine/setup-readiness"
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

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
        <div className="px-6 pb-4">
          <p className="text-sm text-muted-foreground">{props.hint}</p>
        </div>
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

function purposeStatus(
  sectionId: (typeof PURPOSE_SECTIONS)[number]["id"],
  readiness: ReturnType<typeof buildSetupReadiness>
): { label: string; done: boolean } {
  const byId = Object.fromEntries(readiness.steps.map((s) => [s.id, s]))
  switch (sectionId) {
    case "audit":
      return {
        label: byId.audit?.done ? "設定あり" : "未設定",
        done: Boolean(byId.audit?.done),
      }
    case "additions":
      return {
        label: byId.additions?.done ? "設定あり" : "任意・未設定",
        done: Boolean(byId.additions?.done),
      }
    case "ai":
      return {
        label: byId.ai?.done ? "利用可能" : "未完了",
        done: Boolean(byId.ai?.done),
      }
    case "regulatory":
      return {
        label: byId.regulatory?.done ? "設定あり" : "任意・未設定",
        done: Boolean(byId.regulatory?.done),
      }
  }
}

const overviewItems = [
  {
    title: "1. 何を見るかを登録する",
    description:
      "監査対策や加算設定で、AIに見てほしいチェック項目を用意します。介護以外でいえば、衛生点検表・安全点検表・経費確認リストのようなものです。",
  },
  {
    title: "2. どう見ればよいかを登録する",
    description:
      "AI設定で「この欄が空なら確認を促す」「日付の前後関係をご確認ください」のような判断基準を用意します。",
  },
  {
    title: "3. 何を根拠にするかを登録する",
    description:
      "法改正・行政情報で、公式PDFや自治体サイトを参照先として管理します。AIの指摘候補に根拠を添えやすくするための資料置き場です。",
  },
]

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
  const readiness = buildSetupReadiness(d)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          チェック設定ホーム
        </h1>
        <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
          AIが書類をチェックするときの「チェック表・判断基準・根拠資料」を用意する場所です。必須ステップが揃うと「利用可能」になります。
        </p>
      </div>

      <section
        className="space-y-4"
        aria-labelledby="settings-overview-heading"
      >
        <Card className="rounded-xl border-primary/20 bg-primary/[0.03] shadow-subtle">
          <CardHeader className="pb-3">
            <CardTitle
              id="settings-overview-heading"
              className="text-xl text-primary-dark"
            >
              このホームで何を準備するのか
            </CardTitle>
            <CardDescription className="text-base leading-relaxed text-foreground/80">
              世の中の公的ルール・社内チェック表・公式資料を、AIが確認に使える形で登録します。登録した内容は、利用者が書類をアップロードしたときの「不備の可能性があります」「ここをご確認ください」という案内に使われます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 md:grid-cols-3">
              {overviewItems.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-border bg-white p-4"
                >
                  <p className="text-base font-semibold text-primary-dark">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <SetupReadinessPanel readiness={readiness} />

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
            const status = purposeStatus(section.id, readiness)
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
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md text-xs",
                            status.done
                              ? "border-primary/30 bg-primary/10 text-primary-dark"
                              : "border-warning/40 bg-warning/10 text-warning"
                          )}
                        >
                          {status.done ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="size-3" aria-hidden />
                              {status.label}
                            </span>
                          ) : (
                            status.label
                          )}
                        </Badge>
                        <ArrowRight
                          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                          aria-hidden
                        />
                      </div>
                    </div>
                    <CardTitle className="text-lg text-primary-dark">
                      {section.label}
                    </CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {section.purpose}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-sm font-semibold text-primary-dark">
                        登録するデータ
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {section.dataToRegister}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-sm font-semibold text-primary-dark">
                        何に使うか
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {section.usedFor}
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/80">
                      {section.plainExample}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-xl font-bold text-primary-dark">
          件数の詳細
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="対応自治体（市区町村）"
            value={d.supportedMunicipalityCount}
            hint={`管轄マスタ全体 ${d.jurisdictionCount} 件`}
            href="/admin/rules/municipalities"
          />
          <StatCard
            label="監査項目"
            value={d.auditItemCount}
            href="/admin/rules/audit-items"
          />
          <StatCard
            label="加算項目"
            value={d.additionItemCount}
            href="/admin/rules/additions"
          />
          <StatCard
            label="承認済みAIルール"
            value={d.approvedAiRuleCount}
            hint={`ルール総数 ${d.aiRuleCount} 件`}
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
            label="行政資料 / 参照サイト"
            value={d.knowledgeDocumentCount + d.sourceUrlCount}
            hint={`資料 ${d.knowledgeDocumentCount} / URL ${d.sourceUrlCount}`}
            href="/admin/rules/regulatory"
          />
        </div>
      </section>
    </div>
  )
}
