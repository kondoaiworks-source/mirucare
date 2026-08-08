"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  FileText,
  Layers,
  PauseCircle,
  PlayCircle,
} from "lucide-react"
import { getRulesDashboardAction } from "@/app/actions/rule-engine"
import { listRulebookOfferingsAction } from "@/app/actions/rulebook-offerings"
import { AdminEqualCard } from "@/components/features/admin/rules/admin-equal-card"
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
import type { RulebookOfferingRow } from "@/lib/rule-engine/offerings"
import { RULE_SERVICES, servicePath } from "@/lib/rule-engine/services"

type Dashboard = {
  supportedMunicipalityCount: number
  sourceUrlCount: number
  pendingVersionCount: number
  approvedAiRuleCount: number
}

/**
 * 利用設定ハブ：サマリ → サービス → 自治体 → 判定ルール。
 */
export function UsageSettingsHub() {
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [offerings, setOfferings] = useState<RulebookOfferingRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    const [d, o] = await Promise.all([
      getRulesDashboardAction(),
      listRulebookOfferingsAction({ serviceType: "訪問介護" }),
    ])
    if (!d.ok) {
      setError(d.error ?? "集計に失敗しました。")
      setDash(null)
    } else {
      setDash({
        supportedMunicipalityCount: d.data?.supportedMunicipalityCount ?? 0,
        sourceUrlCount: d.data?.sourceUrlCount ?? 0,
        pendingVersionCount: d.data?.pendingVersionCount ?? 0,
        approvedAiRuleCount: d.data?.approvedAiRuleCount ?? 0,
      })
    }
    if (!o.ok) {
      setError((prev) => prev ?? o.error ?? "自治体一覧の取得に失敗しました。")
      setOfferings([])
    } else {
      setOfferings(o.data?.rows ?? [])
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          利用設定
        </h1>
        <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
          サービスと根拠URL、判定ルールを整えます。
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3" aria-labelledby="setup-summary-heading">
        <h2
          id="setup-summary-heading"
          className="text-xl font-bold text-primary-dark"
        >
          登録サマリ
        </h2>
        <p className="text-base text-muted-foreground">いまの登録件数です。</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li>
            <AdminEqualCard
              title="対応自治体"
              description="利用可能な市区町村の数"
              value={dash?.supportedMunicipalityCount ?? "—"}
              icon={Layers}
            />
          </li>
          <li>
            <AdminEqualCard
              title="根拠URL"
              description="登録済みの公開情報件数"
              value={dash?.sourceUrlCount ?? "—"}
              icon={FileText}
            />
          </li>
          <li>
            <AdminEqualCard
              title="了承待ち"
              description="確認が必要な判定ルール"
              value={dash?.pendingVersionCount ?? "—"}
              icon={ClipboardCheck}
              href="/admin/rules/pending"
            />
          </li>
          <li>
            <AdminEqualCard
              title="了承済み"
              description="チェックに使う判定ルール"
              value={dash?.approvedAiRuleCount ?? "—"}
              icon={BookOpen}
              href="/admin/rules/pending#history"
            />
          </li>
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="setup-services-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="setup-services-heading"
              className="text-xl font-bold text-primary-dark"
            >
              提供サービス
            </h2>
            <p className="mt-1 text-base text-muted-foreground">
              追加・詳細は各サービスを開きます。
            </p>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RULE_SERVICES.map((svc) => {
            const active = svc.status === "active"
            return (
              <li key={svc.slug}>
                <AdminEqualCard
                  href={servicePath(svc.slug)}
                  title={svc.label}
                  description={svc.description}
                  icon={Layers}
                  badge={
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="rounded-md"
                    >
                      {active ? (
                        <PlayCircle className="size-3.5" aria-hidden />
                      ) : (
                        <PauseCircle className="size-3.5" aria-hidden />
                      )}
                      {svc.statusLabel}
                    </Badge>
                  }
                />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="setup-cities-heading">
        <div>
          <h2
            id="setup-cities-heading"
            className="text-xl font-bold text-primary-dark"
          >
            サービス×自治体
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            根拠URLと判定ルールを市ごとに整えます。
          </p>
        </div>
        <div className="mb-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href={servicePath("homecare", "national-prefecture")}>
              国・県の根拠URLを開く
            </Link>
          </Button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {offerings.map((row) => {
            const cityHref = row.slug
              ? servicePath("homecare", "municipalities", row.slug)
              : servicePath("homecare", "municipalities")
            const rulesHref = "/admin/rules/pending"
            return (
              <li key={row.id}>
                <Card className="flex h-full min-h-[9.5rem] flex-col rounded-xl shadow-subtle">
                  <CardHeader className="space-y-2 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="line-clamp-1 text-lg text-primary-dark">
                        {row.municipalityName}
                      </CardTitle>
                      <Badge
                        variant={row.isPublished ? "default" : "outline"}
                        className="rounded-md"
                      >
                        {row.isPublished ? "公開中" : "非公開"}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 min-h-[3rem] text-base leading-relaxed">
                      根拠PDF {row.cityPdfCount}件／国
                      {row.nationalPdfCount}・県{row.prefecturePdfCount}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto flex flex-wrap gap-2 pt-0">
                    <Button asChild className="min-h-11">
                      <Link href={cityHref}>根拠URLを整える</Link>
                    </Button>
                    <Button asChild variant="outline" className="min-h-11">
                      <Link href={rulesHref}>判定ルールを開く</Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            )
          })}
          {offerings.length === 0 ? (
            <li className="sm:col-span-2">
              <Card className="rounded-xl shadow-subtle">
                <CardHeader>
                  <CardTitle className="text-lg">自治体がありません</CardTitle>
                  <CardDescription className="text-base">
                    訪問介護の市区町村設定から公開準備を始めてください。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="min-h-11">
                    <Link href={servicePath("homecare", "municipalities")}>
                      市区町村を開く
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="setup-rules-heading">
        <h2
          id="setup-rules-heading"
          className="text-xl font-bold text-primary-dark"
        >
          判定ルール
        </h2>
        <p className="text-base text-muted-foreground">
          生成・了承・履歴はこちらです。
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <AdminEqualCard
              href="/admin/rules/pending"
              title="ルールを管理する"
              description="案の生成・了承と更新履歴"
              icon={ClipboardCheck}
              badge={
                (dash?.pendingVersionCount ?? 0) > 0 ? (
                  <Badge variant="secondary" className="rounded-md tabular-nums">
                    待ち {dash?.pendingVersionCount}
                  </Badge>
                ) : undefined
              }
            />
          </li>
          <li>
            <AdminEqualCard
              href="/admin/rules/audit-items"
              title="監査項目（詳細）"
              description="見出しの初回登録・個別追加"
              icon={BookOpen}
            />
          </li>
        </ul>
      </section>
    </div>
  )
}
