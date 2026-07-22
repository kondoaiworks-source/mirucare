import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  FileSpreadsheet,
  Timer,
  type LucideIcon,
} from "lucide-react"
import { ProductCharterBanner } from "@/components/features/product-charter-banner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { MonthlyHubData } from "@/app/actions/monthly-hub"
import {
  MONTHLY_CORE_DOCS,
  PRODUCT_CHARTER,
} from "@/lib/copy/product-charter"
import { cn } from "@/lib/utils"

type MonthlyCard = {
  href: string
  icon: LucideIcon
  title: string
  description: string
  note: string
}

const MONTHLY_ACTIONS: MonthlyCard[] = [
  {
    href: "/attendance/import?kind=service_records",
    icon: FileSpreadsheet,
    title: "日報CSVを取り込む",
    description: "サービス提供記録（日報）のCSVを事業所データに取り込みます。",
    note: "請求CSVと照合する基準データになります。",
  },
  {
    href: "/attendance/import?kind=attendance",
    icon: Timer,
    title: "勤怠・タイムカードCSVを取り込む",
    description: "出勤・退勤のタイムカードCSVを事業所データに取り込みます。",
    note: "日報との時間ズレ確認に使います。",
  },
  {
    href: "/attendance",
    icon: AlertTriangle,
    title: "勤怠の矛盾を確認する",
    description:
      "取り込んだ日報と勤怠を突き合わせ、ズレや時間の重複の可能性を確認します。",
    note: "取り込んだ日報・勤怠データを使います。",
  },
  {
    href: "/billing-reconcile",
    icon: ClipboardList,
    title: "請求CSVを照合する",
    description:
      "国保連へ送る直前の請求CSVを、取り込んだ日報データと1分単位で照合します。",
    note: "請求CSVはサーバーに保存せず、ブラウザ内だけで処理します。",
  },
]

function coverageBadge(status: MonthlyHubData["coverage"][number]["status"]) {
  switch (status) {
    case "ready":
      return {
        label: "投入済み",
        className: "border-primary/30 bg-primary/10 text-primary-dark",
        Icon: CheckCircle2,
      }
    case "manual":
      return {
        label: "照合時に投入",
        className: "border-border bg-muted text-muted-foreground",
        Icon: CircleDashed,
      }
    default:
      return {
        label: "未投入",
        className: "border-warning/40 bg-warning/10 text-warning",
        Icon: AlertTriangle,
      }
  }
}

function yearMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-")
  return `${y}年${Number(m)}月`
}

type MonthlyHubViewProps = {
  data: MonthlyHubData
}

/**
 * 月末の致命傷予防体験：投入カバレッジ＋矛盾候補一覧＋用途別入口
 */
export function MonthlyHubView({ data }: MonthlyHubViewProps) {
  const missingCount = data.coverage.filter((c) => c.status === "missing").length
  const contradictionTotalHint = data.contradictionTruncated
    ? `${data.contradictions.length}件以上`
    : `${data.contradictions.length}件`

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">月末の確認</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {PRODUCT_CHARTER.monthlyHubLead}
          対象は{" "}
          <span className="font-semibold tabular-nums text-primary-dark">
            {yearMonthLabel(data.yearMonth)}
          </span>{" "}
          です。
        </p>
      </div>

      <ProductCharterBanner extra={PRODUCT_CHARTER.unverifiedScope} />

      <section className="space-y-3" aria-labelledby="coverage-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="coverage-heading"
              className="text-lg font-bold text-primary-dark"
            >
              4大書類の投入状況
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              検証カバレッジ（投入済み／未投入）。未投入の範囲は未検証です。
            </p>
          </div>
          <p className="text-sm tabular-nums text-muted-foreground">
            追跡可能な投入{" "}
            <span className="text-2xl font-bold text-primary-dark">
              {data.readyCount}
            </span>
            <span> / {data.totalTracked}</span>
          </p>
        </div>

        {missingCount > 0 ? (
          <Alert className="rounded-xl border-warning/40 bg-warning/10">
            <AlertTriangle className="text-warning" />
            <AlertTitle>未投入の書類があります</AlertTitle>
            <AlertDescription className="text-base leading-relaxed">
              {missingCount}
              種が未投入のため、矛盾候補の一覧は一部しか見えていない可能性があります。投入してから再度ご確認ください。
            </AlertDescription>
          </Alert>
        ) : null}

        <ul className="grid gap-3">
          {data.coverage.map((item) => {
            const meta = MONTHLY_CORE_DOCS.find((d) => d.id === item.id)
            const badge = coverageBadge(item.status)
            const Icon = badge.Icon
            return (
              <li key={item.id}>
                <Card className="rounded-xl shadow-subtle">
                  <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base text-primary-dark">
                          {meta?.title ?? item.id}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg px-2.5 py-1",
                            badge.className
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden />
                          {badge.label}
                        </Badge>
                      </div>
                      <CardDescription className="text-base leading-relaxed">
                        {item.detail}
                      </CardDescription>
                      {meta?.hint ? (
                        <p className="text-sm text-muted-foreground">
                          {meta.hint}
                        </p>
                      ) : null}
                    </div>
                    <Button asChild variant="outline" className="min-h-11 shrink-0">
                      <Link href={item.href}>{item.cta}</Link>
                    </Button>
                  </CardHeader>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="candidates-heading">
        <div>
          <h2
            id="candidates-heading"
            className="text-lg font-bold text-primary-dark"
          >
            矛盾候補（勤怠×日報）
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            断定ではありません。「〜の可能性」としてご確認ください。請求CSVとの照合は下の入口から別途行います。
          </p>
        </div>

        {data.contradictions.length === 0 ? (
          <Card className="rounded-xl shadow-subtle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-primary-dark">
                <CheckCircle2 className="size-5 text-primary" aria-hidden />
                この月では矛盾候補は見つかっていません
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">
                {PRODUCT_CHARTER.unverifiedScope}
                日報・勤怠の両方を投入したうえで、詳細画面でも期間を指定して再確認できます。
              </CardDescription>
              <div className="pt-2">
                <Button asChild variant="outline" className="min-h-11">
                  <Link href="/attendance">期間を指定して再確認する</Link>
                </Button>
              </div>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm tabular-nums text-muted-foreground">
              表示中 {contradictionTotalHint}
              {data.contradictionTruncated
                ? "（続きは勤怠の矛盾確認へ）"
                : null}
            </p>
            <ul className="grid gap-3">
              {data.contradictions.map((c, index) => (
                <li key={`${c.helper_id}-${c.date}-${c.error_type}-${index}`}>
                  <Card className="rounded-xl shadow-subtle">
                    <CardHeader className="gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-lg",
                            c.error_type === "OVERLAP"
                              ? "border-danger/30 bg-danger/10 text-danger"
                              : "border-warning/40 bg-warning/10 text-warning"
                          )}
                        >
                          {c.error_type === "OVERLAP"
                            ? "時間重複の可能性"
                            : "打刻と実績のずれの可能性"}
                        </Badge>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {c.date}
                        </span>
                      </div>
                      <CardTitle className="text-base font-semibold text-primary-dark">
                        {c.helper_name}
                      </CardTitle>
                      <CardDescription className="text-base leading-relaxed text-foreground/80">
                        {c.message}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="min-h-11 w-full sm:w-auto">
              <Link href="/attendance">すべての矛盾候補を確認する</Link>
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="text-lg font-bold text-primary-dark">
          用途別の入口
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          入れるデータごとに場所が分かれています。目的に合うカードを選んでください。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {MONTHLY_ACTIONS.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.href}
                href={card.href}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full rounded-xl shadow-subtle transition-colors hover:border-primary/40">
                  <CardHeader>
                    <Icon className="mb-2 size-8 text-primary" aria-hidden />
                    <CardTitle className="text-lg">{card.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {card.description}
                    </CardDescription>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {card.note}
                    </p>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
