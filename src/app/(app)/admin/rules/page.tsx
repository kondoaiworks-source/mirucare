import type { Metadata } from "next"
import Link from "next/link"
import { getRulesDashboardAction } from "@/app/actions/rule-engine"
import { SetupReadinessPanel } from "@/components/features/admin/setup-readiness-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PURPOSE_SECTIONS } from "@/lib/rule-engine/purpose-sections"
import { buildSetupReadiness } from "@/lib/rule-engine/setup-readiness"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  History,
  Hourglass,
  MapPin,
} from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "ルール設定",
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

const HOME_SHORTCUTS = [
  {
    href: "/admin/rules/regulatory",
    label: "ルールブック設定",
    description:
      "国・県・市の参照URLと資料を整え、この自治体の確定版を保ちます。",
    icon: BookOpen,
  },
  {
    href: "/admin/rules/pending",
    label: "承認待ち",
    description: "人がOKするまで、チェック基準に載せません。",
    icon: Hourglass,
  },
  {
    href: "/admin/rules/history",
    label: "更新履歴",
    description: "いつの版に変わったかを確認できます。",
    icon: History,
  },
  {
    href: "/admin/rules/municipalities",
    label: "自治体マスタ",
    description: "Phase1市（横浜・川崎・藤沢・鎌倉・茅ヶ崎）などの対応。",
    icon: MapPin,
  },
  {
    href: "/admin/rules/notifications",
    label: "通知一覧",
    description: "更新アラートなどの通知履歴です。",
    icon: Bell,
  },
  {
    href: "/admin/rules/jobs",
    label: "運用監視",
    description: "同期・監視の実行状況（トラブル時）。",
    icon: Activity,
  },
] as const

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
  const homeSections = PURPOSE_SECTIONS.filter((s) => s.showOnHome === true)
  const rulebookStatus =
    d.knowledgeDocumentCount + d.sourceUrlCount > 0
      ? { label: "設定あり", done: true }
      : { label: "これから", done: false }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          ルール設定
        </h1>
        <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
          この自治体でサービスを運営するなら、このルールブックに従えばよい——が中心です。更新アラートは自動で立ち、人が確認して最新に保ちます（合否・返還は保証しません）。
        </p>
      </div>

      <SetupReadinessPanel readiness={readiness} />

      {(d.pendingVersionCount > 0 ||
        d.pendingKnowledgeDraftCount > 0 ||
        d.openSyncAlertCount > 0) && (
        <Alert className="rounded-xl border-warning/30 bg-warning/5">
          <AlertCircle className="text-warning" />
          <AlertTitle>更新アラート・確認待ちがあります</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-2 pt-2">
            {d.pendingVersionCount > 0 ? (
              <Link href="/admin/rules/pending">
                <Badge variant="destructive" className="rounded-lg tabular-nums">
                  ルール承認待ち {d.pendingVersionCount}
                </Badge>
              </Link>
            ) : null}
            {d.pendingKnowledgeDraftCount > 0 ? (
              <Link href="/admin/document-changes">
                <Badge variant="destructive" className="rounded-lg tabular-nums">
                  マニュアル差分 {d.pendingKnowledgeDraftCount}
                </Badge>
              </Link>
            ) : null}
            {d.openSyncAlertCount > 0 ? (
              <Link href="/admin/rules/jobs">
                <Badge variant="outline" className="rounded-lg tabular-nums">
                  同期アラート {d.openSyncAlertCount}
                </Badge>
              </Link>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-4" aria-labelledby="rulebook-entry-heading">
        <h2
          id="rulebook-entry-heading"
          className="text-xl font-bold text-primary-dark"
        >
          ルールブックから始める
        </h2>
        <div className="grid gap-4 sm:grid-cols-1">
          {homeSections.map((section) => {
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
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md text-xs",
                            rulebookStatus.done
                              ? "border-primary/30 bg-primary/10 text-primary-dark"
                              : "border-warning/40 bg-warning/10 text-warning"
                          )}
                        >
                          {rulebookStatus.done ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="size-3" aria-hidden />
                              {rulebookStatus.label}
                            </span>
                          ) : (
                            rulebookStatus.label
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
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="menu-heading">
        <h2 id="menu-heading" className="text-xl font-bold text-primary-dark">
          メニュー
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {HOME_SHORTCUTS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full rounded-xl shadow-subtle transition-colors group-hover:border-primary/30">
                  <CardHeader className="space-y-2">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <CardTitle className="text-base text-primary-dark">
                      {item.label}
                    </CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {item.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          監査項目・判定ルール・加算など細かい編集は{" "}
          <Link
            href="/admin/rules/more"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            詳細設定
          </Link>
          にあります。構想の正は docs/ルールブック構想.md です。
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-xl font-bold text-primary-dark">
          いまの件数
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="参照URL / 行政資料"
            value={d.knowledgeDocumentCount + d.sourceUrlCount}
            hint={`資料 ${d.knowledgeDocumentCount} / URL ${d.sourceUrlCount}`}
            href="/admin/rules/regulatory"
          />
          <StatCard
            label="承認済み判定ルール"
            value={d.approvedAiRuleCount}
            hint={`ルール総数 ${d.aiRuleCount} 件（詳細設定）`}
            href="/admin/rules/ai-rules"
          />
          <StatCard
            label="承認待ち"
            value={d.pendingVersionCount}
            href="/admin/rules/pending"
            warn={d.pendingVersionCount > 0}
          />
          <StatCard
            label="更新アラート（未承認差分）"
            value={d.pendingKnowledgeDraftCount}
            href="/admin/document-changes"
            warn={d.pendingKnowledgeDraftCount > 0}
          />
          <StatCard
            label="対応自治体"
            value={d.supportedMunicipalityCount}
            href="/admin/rules/municipalities"
          />
          <StatCard
            label="監査項目"
            value={d.auditItemCount}
            hint="詳細設定"
            href="/admin/rules/audit-items"
          />
        </div>
      </section>
    </div>
  )
}
