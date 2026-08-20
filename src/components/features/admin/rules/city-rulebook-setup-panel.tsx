"use client"

import Link from "next/link"
import type { CityRulebookSetupReadiness } from "@/lib/rule-engine/city-rulebook-setup-readiness"
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
import {
  Check,
  CheckCircle2,
  Circle,
  ListChecks,
  Minus,
  X,
} from "lucide-react"

type Props = {
  readiness: CityRulebookSetupReadiness
  citySlug: string
}

function statusBadgeClass(label: CityRulebookSetupReadiness["statusLabel"]) {
  switch (label) {
    case "完了":
      return "border-primary/30 bg-primary/10 text-primary-dark"
    case "準備中":
      return "border-warning/40 bg-warning/10 text-warning"
    case "要確認":
      return "border-accent/40 bg-accent/10 text-accent"
    default:
      return "border-muted-foreground/20 bg-muted text-muted-foreground"
  }
}

function CoverageIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <Check className="size-4 shrink-0 text-primary" aria-hidden />
  ) : (
    <X className="size-4 shrink-0 text-danger" aria-hidden />
  )
}

function coverageStatusClass(status: string) {
  if (status === "確認済み") {
    return "border-primary/30 bg-primary/10 text-primary-dark"
  }
  if (status === "了承待ち") {
    return "border-accent/40 bg-accent/10 text-accent"
  }
  if (status === "根拠確認待ち") {
    return "border-warning/40 bg-warning/10 text-warning"
  }
  return "border-muted-foreground/20 bg-muted text-muted-foreground"
}

export function CityRulebookSetupPanel({ readiness, citySlug }: Props) {
  const {
    cityName,
    steps,
    phase1Checks,
    frequentCoverage,
    stepsDone,
    stepsTotal,
    phase1Approved,
    phase1Total,
    frequentApproved,
    frequentTotal,
    frequentWithEvidence,
    frequentPending,
    frequentMissing,
    statusLabel,
    nextStep,
    isComplete,
  } = readiness

  return (
    <Card
      id="city-setup"
      className="rounded-xl border-primary/20 bg-primary/[0.02] shadow-subtle"
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg text-primary-dark">
              <ListChecks className="size-5 shrink-0 text-primary" aria-hidden />
              {cityName}の初回登録
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              この市のルールブックを整える手順です。下に進むほど確定版に近づきます。
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "rounded-lg px-3 py-1.5 text-base font-semibold",
                statusBadgeClass(statusLabel)
              )}
            >
              {statusLabel}
            </Badge>
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href="/admin/rules/setup">
                利用設定へ戻る
              </Link>
            </Button>
          </div>
        </div>
        <p className="text-sm tabular-nums text-muted-foreground">
          手順 {stepsDone}/{stepsTotal} · 基本の頻出観点 {phase1Approved}/
          {phase1Total}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <ol className="space-y-2" aria-label={`${cityName}の登録手順`}>
          {steps.map((step) => (
            <li key={step.id}>
              <a
                href={`#${step.anchorId}`}
                className={cn(
                  "flex min-h-11 items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  step.done
                    ? "border-primary/20 bg-white hover:bg-primary/[0.03]"
                    : "border-border bg-white hover:border-primary/30"
                )}
              >
                <span className="mt-0.5 shrink-0" aria-hidden>
                  {step.done ? (
                    <CheckCircle2 className="size-5 text-primary" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                      {step.order}.
                    </span>
                    <span className="text-base font-semibold text-primary-dark">
                      {step.label}
                    </span>
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
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {step.detail}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>

        <section
          id="city-setup-frequent-coverage"
          aria-labelledby="city-frequent-coverage-heading"
          className="space-y-3 rounded-xl border border-border bg-white p-4"
        >
          <div className="space-y-1">
            <h3
              id="city-frequent-coverage-heading"
              className="text-base font-bold text-primary-dark"
            >
              監査観点の確認状況
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              設定した頻出観点について、ルール化・根拠PDF・了承待ちの状態を確認します。出ていない項目は「問題なし」ではなく、未確認の範囲です。
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">了承済み</p>
              <p className="text-lg font-bold tabular-nums text-primary-dark">
                {frequentApproved}/{frequentTotal}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">根拠あり</p>
              <p className="text-lg font-bold tabular-nums text-primary-dark">
                {frequentWithEvidence}/{frequentTotal}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">了承待ち</p>
              <p className="text-lg font-bold tabular-nums text-primary-dark">
                {frequentPending}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">未作成</p>
              <p className="text-lg font-bold tabular-nums text-primary-dark">
                {frequentMissing}
              </p>
            </div>
          </div>

          <details className="rounded-lg border bg-muted/20">
            <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-primary-dark outline-none focus-visible:ring-2 focus-visible:ring-ring">
              観点ごとの不足理由を見る
            </summary>
            <div className="overflow-x-auto border-t bg-white">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">観点</th>
                    <th className="px-3 py-2 font-semibold">分類</th>
                    <th className="px-3 py-2 font-semibold">根拠</th>
                    <th className="px-3 py-2 font-semibold">状態</th>
                    <th className="px-3 py-2 font-semibold">次にやること</th>
                  </tr>
                </thead>
                <tbody>
                  {frequentCoverage.map((row) => (
                    <tr key={row.code} className="border-b last:border-b-0">
                      <td className="px-3 py-2">
                        <span className="font-medium text-primary-dark">
                          {row.title}
                        </span>
                        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                          {row.code}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.category}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.sourceLabel}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md",
                            coverageStatusClass(row.statusLabel)
                          )}
                        >
                          {row.statusLabel}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.nextAction}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section id="city-setup-phase1" aria-labelledby="city-phase1-heading">
          <h3
            id="city-phase1-heading"
            className="mb-3 text-base font-bold text-primary-dark"
          >
            頻出観点の基本確認（この市）
          </h3>
          <div className="space-y-3">
            {phase1Checks.map((check) => (
              <div
                key={check.no}
                className={cn(
                  "rounded-lg border bg-white p-3",
                  check.done ? "border-primary/20" : "border-border"
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    項目{check.no}
                  </span>
                  <span className="text-sm font-bold text-primary-dark">
                    {check.title}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-md text-xs",
                      check.done
                        ? "border-primary/30 bg-primary/10 text-primary-dark"
                        : "border-warning/40 bg-warning/10 text-warning"
                    )}
                  >
                    {check.done ? "OK" : "抜けあり"}
                  </Badge>
                </div>
                <ul className="space-y-1 text-sm">
                  {check.rules.map((rule) => (
                    <li
                      key={rule.code}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1"
                    >
                      <span className="min-w-0 flex-1 font-medium text-primary-dark">
                        {rule.title}
                      </span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        監査
                        <CoverageIcon ok={rule.hasAuditItem} />
                      </span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        了承
                        <CoverageIcon ok={rule.hasApprovedRule} />
                      </span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        根拠
                        {rule.hasApprovedRule ? (
                          <CoverageIcon ok={rule.hasDocumentEvidence} />
                        ) : (
                          <Minus className="size-4" aria-hidden />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {!isComplete && nextStep ? (
          <div className="rounded-lg border border-dashed border-primary/25 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-muted-foreground">
              次にやること
            </p>
            <p className="mt-1 font-bold text-primary-dark">{nextStep.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {nextStep.description}
            </p>
            <Button asChild size="sm" className="mt-3 min-h-11">
              <a href={`#${nextStep.anchorId}`}>該当セクションへ移動する</a>
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 text-sm">
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link
              href={`/admin/rules/services/homecare/municipalities/${citySlug}/rules`}
            >
              判定ルール管理
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/admin/rules/documents?city=${citySlug}`}>
              公開情報監視
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
