import Link from "next/link"
import { CheckCircle2, Circle, ListChecks } from "lucide-react"
import type { SetupReadiness } from "@/lib/rule-engine/setup-readiness"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type SetupReadinessPanelProps = {
  readiness: SetupReadiness
}

function statusBadgeClass(label: SetupReadiness["statusLabel"]) {
  switch (label) {
    case "利用可能":
      return "border-primary/30 bg-primary/10 text-primary-dark"
    case "準備中":
      return "border-warning/40 bg-warning/10 text-warning"
    case "要対応あり":
      return "border-danger/30 bg-danger/5 text-danger"
    default:
      return "border-muted-foreground/20 bg-muted text-muted-foreground"
  }
}

/**
 * ルール設定ホーム用：設定完了度と次アクションを明示する。
 */
export function SetupReadinessPanel({ readiness }: SetupReadinessPanelProps) {
  const {
    steps,
    requiredDone,
    requiredTotal,
    optionalDone,
    optionalTotal,
    statusLabel,
    statusHint,
    nextStep,
    isReady,
  } = readiness

  const progressPct =
    requiredTotal === 0
      ? 0
      : Math.round((requiredDone / requiredTotal) * 100)

  return (
    <Card className="rounded-xl border-primary/20 bg-primary/[0.02] shadow-subtle">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl text-primary-dark">
              <ListChecks className="size-5 shrink-0 text-primary" aria-hidden />
              準備の進み具合
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-relaxed text-foreground/80">
              {statusHint}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "rounded-lg px-3 py-1.5 text-base font-semibold",
              statusBadgeClass(statusLabel)
            )}
          >
            {statusLabel}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-base text-muted-foreground">
              必須{" "}
              <span className="text-2xl font-bold tabular-nums text-primary-dark">
                {requiredDone}
              </span>
              <span className="tabular-nums"> / {requiredTotal}</span>
              <span className="mx-2 text-muted-foreground/50" aria-hidden>
                ·
              </span>
              任意{" "}
              <span className="font-semibold tabular-nums text-primary-dark">
                {optionalDone}
              </span>
              <span className="tabular-nums"> / {optionalTotal}</span>
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">
              必須の完了率 {progressPct}%
            </p>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="必須ステップの完了率"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <ul className="space-y-3" aria-label="準備チェックリスト">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <li key={step.id}>
                <Link
                  href={step.href}
                  className={cn(
                    "flex min-h-11 gap-3 rounded-xl border px-4 py-3 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    step.done
                      ? "border-primary/20 bg-white hover:bg-primary/[0.03]"
                      : "border-border bg-white hover:border-primary/30 hover:bg-muted/40"
                  )}
                >
                  <span className="mt-0.5 shrink-0" aria-hidden>
                    {step.done ? (
                      <CheckCircle2 className="size-6 text-primary" />
                    ) : (
                      <Circle className="size-6 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Icon
                        className="size-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span className="text-base font-semibold text-primary-dark">
                        {step.label}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md text-xs",
                          step.required
                            ? "border-primary/20 text-primary-dark"
                            : "text-muted-foreground"
                        )}
                      >
                        {step.required ? "必須" : "任意"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md text-xs",
                          step.done
                            ? "border-primary/30 bg-primary/10 text-primary-dark"
                            : "border-warning/40 bg-warning/10 text-warning"
                        )}
                      >
                        {step.done ? "完了" : "未完了"}
                      </Badge>
                    </span>
                    <span className="block text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </span>
                    <span className="block text-sm font-medium tabular-nums text-foreground/80">
                      {step.detail}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="rounded-xl border border-dashed border-primary/25 bg-white px-4 py-4">
          {nextStep ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  次にやること
                </p>
                <p className="mt-1 text-lg font-bold text-primary-dark">
                  {nextStep.label}
                </p>
                <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                  {nextStep.description}
                </p>
              </div>
              <Button asChild size="lg" className="min-h-11 shrink-0">
                <Link href={nextStep.href}>{nextStep.actionLabel}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-bold text-primary-dark">
                {isReady
                  ? "必須の準備は完了しています"
                  : "次の作業はありません"}
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                本サービスはWチェック支援です。最終判断・提出は貴施設の責任で行ってください。
                法改正時は「ルールブック管理」の更新アラートをご確認ください。
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
