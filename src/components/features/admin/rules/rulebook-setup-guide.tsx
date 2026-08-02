"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import Link from "next/link"
import { toast } from "@/components/ui/sonner"
import {
  seedPhase1RulebookBasicsAction,
} from "@/app/actions/rule-engine"
import type {
  RulebookSetupReadiness,
  RulebookSetupStepId,
} from "@/lib/rule-engine/rulebook-setup-readiness"
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
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  ExternalLink,
  FileText,
  Link2,
  ListChecks,
  Loader2,
  MapPin,
  Minus,
  RefreshCw,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react"

const STEP_ICONS: Record<RulebookSetupStepId, LucideIcon> = {
  jurisdictions: MapPin,
  referenceUrls: Link2,
  documents: FileText,
  auditItems: ClipboardList,
  generateRules: Sparkles,
  approveRules: Bot,
  clearQueue: CheckCircle2,
}

type RulebookSetupGuideProps = {
  readiness: RulebookSetupReadiness
}

function statusBadgeClass(label: RulebookSetupReadiness["statusLabel"]) {
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
  if (ok) {
    return <Check className="size-4 shrink-0 text-primary" aria-hidden />
  }
  return <X className="size-4 shrink-0 text-danger" aria-hidden />
}

export function RulebookSetupGuide({ readiness }: RulebookSetupGuideProps) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [seeding, startSeed] = useTransition()

  const {
    steps,
    sharedLayers,
    cities,
    phase1Checks,
    requiredDone,
    requiredTotal,
    phase1RuleApproved,
    phase1RuleTotal,
    phase1RuleWithEvidence,
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
    <Card className="rounded-lg border-primary/20 bg-primary/[0.02] shadow-subtle">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl text-primary-dark">
              <ListChecks
                className="size-5 shrink-0 text-primary"
                aria-hidden
              />
              初回登録の手順
            </CardTitle>
            <CardDescription className="max-w-3xl text-base leading-relaxed text-foreground/85">
              自治体ルール（国・県・市）を正として、Phase1向けルールブックを整えます。
              各ステップの完了状況と、項目1・3・7・8の抜け漏れをこの画面で確認できます。
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={refreshing}
              onClick={() => {
                startRefresh(() => {
                  router.refresh()
                })
              }}
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              最新の状態を確認する
            </Button>
          </div>
        </div>

        <p className="text-base leading-relaxed text-muted-foreground">
          {statusHint}
        </p>

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-base text-muted-foreground">
              必須手順{" "}
              <span className="text-2xl font-bold tabular-nums text-primary-dark">
                {requiredDone}
              </span>
              <span className="tabular-nums"> / {requiredTotal}</span>
              <span className="mx-2 text-muted-foreground/50" aria-hidden>
                ·
              </span>
              Phase1ルール{" "}
              <span className="font-semibold tabular-nums text-primary-dark">
                {phase1RuleApproved}
              </span>
              <span className="tabular-nums"> / {phase1RuleTotal}</span>
              <span className="text-sm text-muted-foreground">
                （根拠付き {phase1RuleWithEvidence}）
              </span>
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">
              手順完了率 {progressPct}%
            </p>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="必須手順の完了率"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        <section aria-labelledby="setup-steps-heading">
          <h3
            id="setup-steps-heading"
            className="mb-3 text-lg font-bold text-primary-dark"
          >
            登録手順（この順で進めてください）
          </h3>
          <ol className="space-y-4">
            {steps.map((step) => {
              const Icon = STEP_ICONS[step.id]
              return (
                <li
                  key={step.id}
                  className={cn(
                    "rounded-xl border bg-white px-4 py-4",
                    step.done ? "border-primary/20" : "border-border"
                  )}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <span className="mt-0.5 shrink-0" aria-hidden>
                        {step.done ? (
                          <CheckCircle2 className="size-6 text-primary" />
                        ) : (
                          <Circle className="size-6 text-muted-foreground" />
                        )}
                      </span>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                            手順 {step.order}
                          </span>
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
                              step.done
                                ? "border-primary/30 bg-primary/10 text-primary-dark"
                                : "border-warning/40 bg-warning/10 text-warning"
                            )}
                          >
                            {step.done ? "完了" : "未完了"}
                          </Badge>
                        </div>
                        <p className="text-base leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                        <p className="text-sm font-medium tabular-nums text-foreground/80">
                          {step.detail}
                        </p>
                        <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-muted-foreground">
                          {step.howTo.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <Button
                      asChild
                      variant={step.done ? "outline" : "default"}
                      size="lg"
                      className="min-h-11 shrink-0"
                    >
                      <Link href={step.href}>
                        {step.actionLabel}
                        <ExternalLink className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <section aria-labelledby="shared-layers-heading">
          <h3
            id="shared-layers-heading"
            className="mb-3 text-lg font-bold text-primary-dark"
          >
            国・県・市の公開情報と公開情報監視
          </h3>
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
            公開情報と台帳化された資料が揃っているか、層ごとに目視してください。
          </p>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[480px] text-left text-base">
              <thead>
                <tr className="border-b bg-muted/40 text-sm text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">層</th>
                  <th className="px-4 py-3 font-semibold tabular-nums">
                    公開情報
                  </th>
                  <th className="px-4 py-3 font-semibold tabular-nums">
                    公開情報監視
                  </th>
                  <th className="px-4 py-3 font-semibold">状態</th>
                </tr>
              </thead>
              <tbody>
                {sharedLayers.map((row) => (
                  <tr key={row.code} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium text-primary-dark">
                      {row.label}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.sourceUrlCount}</td>
                    <td className="px-4 py-3 tabular-nums">{row.documentCount}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md",
                          row.done
                            ? "border-primary/30 bg-primary/10 text-primary-dark"
                            : "border-warning/40 bg-warning/10 text-warning"
                        )}
                      >
                        {row.done ? "OK" : "要確認"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {cities.map((city) => (
                  <tr key={city.slug} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`${city.href}#city-setup`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {city.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {city.sourceUrlCount}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {city.documentCount}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md",
                          city.done
                            ? "border-primary/30 bg-primary/10 text-primary-dark"
                            : "border-warning/40 bg-warning/10 text-warning"
                        )}
                      >
                        {city.done ? "OK" : "要確認"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="phase1-coverage-heading">
          <h3
            id="phase1-coverage-heading"
            className="mb-1 text-lg font-bold text-primary-dark"
          >
            Phase1突合の網羅（項目1・3・7・8）
          </h3>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            運用AI監査で見る4本の突合について、監査項目・了承済みルール・行政根拠の3点が揃っているか確認します。
            ✓＝揃っている、✗＝不足があります。
          </p>
          <div className="space-y-4">
            {phase1Checks.map((check) => (
              <div
                key={check.no}
                className={cn(
                  "rounded-xl border bg-white p-4",
                  check.done ? "border-primary/20" : "border-border"
                )}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                    項目{check.no}
                  </span>
                  <span className="text-base font-bold text-primary-dark">
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
                    {check.done ? "網羅OK" : "抜けあり"}
                  </Badge>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                  {check.description}
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-muted-foreground">
                        <th className="px-3 py-2 font-semibold">判定ルール</th>
                        <th className="px-3 py-2 font-semibold">監査項目</th>
                        <th className="px-3 py-2 font-semibold">了承済み</th>
                        <th className="px-3 py-2 font-semibold">行政根拠</th>
                      </tr>
                    </thead>
                    <tbody>
                      {check.rules.map((rule) => (
                        <tr key={rule.code} className="border-b last:border-b-0">
                          <td className="px-3 py-2">
                            <span className="font-medium text-primary-dark">
                              {rule.title}
                            </span>
                            <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                              {rule.code}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <CoverageIcon ok={rule.hasAuditItem} />
                              <span className="sr-only">
                                {rule.hasAuditItem ? "あり" : "なし"}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <CoverageIcon ok={rule.hasApprovedRule} />
                              <span className="sr-only">
                                {rule.hasApprovedRule ? "あり" : "なし"}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5">
                              {rule.hasApprovedRule ? (
                                <CoverageIcon ok={rule.hasDocumentEvidence} />
                              ) : (
                                <Minus
                                  className="size-4 text-muted-foreground"
                                  aria-hidden
                                />
                              )}
                              <span className="sr-only">
                                {rule.hasDocumentEvidence
                                  ? "根拠あり"
                                  : rule.hasApprovedRule
                                    ? "根拠不足"
                                    : "未了承"}
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-xl border border-dashed border-primary/25 bg-white px-4 py-4">
          {nextStep && !isReady ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  次に進む手順
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
                  ? "初回登録が整いました"
                  : "すべての手順を確認しました"}
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                本サービスはWチェック支援です。最終判断・提出は貴施設の責任で行ってください。
              </p>
            </div>
          )}
        </div>

        <details className="rounded-xl border border-dashed bg-muted/30">
          <summary className="cursor-pointer list-none px-4 py-3 text-base text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex min-h-11 items-center justify-between gap-2">
              検証用ショートカット（一括テンプレ登録）
              <ChevronDown className="size-4 shrink-0" aria-hidden />
            </span>
          </summary>
          <div className="border-t border-dashed px-4 py-4">
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              開発・検証用です。監査項目テンプレとPhase1判定ルールを一括投入します（根拠は付きません）。
              本番の初回登録は上記手順どおり、市ルールブックから進めてください。
            </p>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11"
              disabled={seeding}
              onClick={() => {
                startSeed(async () => {
                  const result = await seedPhase1RulebookBasicsAction()
                  if (!result.ok) {
                    toast.error(result.error ?? "一括登録に失敗しました。")
                    return
                  }
                  const d = result.data
                  toast.success(
                    `一括登録完了（監査項目 +${d?.auditInserted ?? 0}・判定ルール +${d?.rulesInserted ?? 0}）`
                  )
                  router.refresh()
                })
              }}
            >
              {seeding ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              テンプレ＋Phase1ルールを一括登録する
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
