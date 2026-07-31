"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  listRulebookOfferingsAction,
  setRulebookOfferingPublishedAction,
} from "@/app/actions/rulebook-offerings"
import type { RulebookOfferingRow } from "@/lib/rule-engine/offerings"
import { servicePath } from "@/lib/rule-engine/services"
import type { ServiceType } from "@/types/database"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertTriangle,
  BookOpen,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

const SERVICE_TABS: Array<{ value: ServiceType; label: string; hint: string }> =
  [
    {
      value: "訪問介護",
      label: "訪問介護",
      hint: "公開中の市だけが施設の登録・設定で選べます。",
    },
    {
      value: "通所介護",
      label: "通所介護",
      hint: "公開するまで施設側の選択肢には出ません（段階公開）。",
    },
    {
      value: "その他",
      label: "その他",
      hint: "公開するまで施設側の選択肢には出ません。",
    },
  ]

type OfferingsAdminProps = {
  /** 指定時はサービスタブを隠し、当該サービスのみ表示 */
  fixedServiceType?: ServiceType
  /**
   * 市詳細リンク用のサービス slug（Server→Client に関数を渡せないため文字列で渡す）
   * 省略時は旧ルールブックパス
   */
  serviceSlug?: string
  /** 国・県設定への導線 */
  nationalPrefectureHref?: string
  title?: string
  description?: string
}

export function OfferingsAdmin({
  fixedServiceType,
  serviceSlug,
  nationalPrefectureHref,
  title = "公開設定（サービス × 自治体）",
  description = "市ルールブックを整えたうえで公開します。非公開にしても、すでに選んでいる施設の設定は据え置きです。市を公開するには、共通層（国・県）と当該市の公開情報PDFが必要です。",
}: OfferingsAdminProps = {}) {
  const [serviceType, setServiceType] = useState<ServiceType>(
    fixedServiceType ?? "訪問介護"
  )
  const [rows, setRows] = useState<RulebookOfferingRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(async (svc: ServiceType) => {
    setLoading(true)
    setError(null)
    const result = await listRulebookOfferingsAction({ serviceType: svc })
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      setRows([])
    } else {
      setRows(result.data?.rows ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (fixedServiceType) {
      setServiceType(fixedServiceType)
    }
  }, [fixedServiceType])

  useEffect(() => {
    void refresh(serviceType)
  }, [refresh, serviceType])

  function togglePublish(row: RulebookOfferingRow) {
    if (!row.jurisdictionId) return
    startTransition(async () => {
      const result = await setRulebookOfferingPublishedAction({
        serviceType,
        jurisdictionId: row.jurisdictionId,
        publish: !row.isPublished,
      })
      if (!result.ok) {
        toast.error(result.error ?? "更新に失敗しました。")
        return
      }
      toast.success(
        row.isPublished
          ? "停止しました。既存施設の設定はそのまま残ります。"
          : "運用を開始しました。施設の登録・設定で選べるようになります。"
      )
      await refresh(serviceType)
    })
  }

  const tab = SERVICE_TABS.find((t) => t.value === serviceType)
  const sharedNational = rows[0]?.nationalPdfCount ?? 0
  const sharedPref = rows[0]?.prefecturePdfCount ?? 0

  return (
    <Card className="rounded-xl shadow-subtle">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg text-primary-dark">{title}</CardTitle>
            <CardDescription className="mt-1 text-base leading-relaxed">
              {description}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11"
            disabled={loading || pending}
            onClick={() => void refresh(serviceType)}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            再読み込み
          </Button>
        </div>

        {!fixedServiceType ? (
          <>
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="サービス種別"
            >
              {SERVICE_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={serviceType === t.value}
                  className={cn(
                    "min-h-11 rounded-lg border px-4 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    serviceType === t.value
                      ? "border-primary bg-primary/10 text-primary-dark"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => setServiceType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab ? (
              <p className="text-base leading-relaxed text-muted-foreground">
                {tab.hint}
              </p>
            ) : null}
          </>
        ) : null}

        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-base leading-relaxed">
          <p className="font-semibold text-primary-dark">共通層（国・県）のPDF</p>
          <p className="mt-1 text-muted-foreground">
            国{" "}
            <span className="font-semibold tabular-nums text-primary-dark">
              {sharedNational}
            </span>
            件 ／ 神奈川県{" "}
            <span className="font-semibold tabular-nums text-primary-dark">
              {sharedPref}
            </span>
            件
            {sharedNational < 1 || sharedPref < 1 ? (
              <span className="ml-2 text-warning">
                （不足していると市を公開できません）
              </span>
            ) : (
              <span className="ml-2 text-primary">（市公開の前提を満たしています）</span>
            )}
          </p>
          {nationalPrefectureHref ? (
            <p className="mt-2">
              <Link
                href={nationalPrefectureHref}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                国・県ルール設定を開く
              </Link>
            </p>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive" className="rounded-xl">
            <AlertTriangle />
            <AlertTitle>読み込みエラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>自治体</TableHead>
                <TableHead>市PDF</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.serviceType}-${row.jurisdictionCode}`}>
                  <TableCell>
                    <div className="font-medium text-primary-dark">
                      {row.municipalityName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {row.prefectureName}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.cityPdfCount}件
                  </TableCell>
                  <TableCell>
                    {row.isPublished ? (
                      <Badge className="rounded-md bg-primary/15 text-primary-dark">
                        運用中
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-md">
                        停止
                      </Badge>
                    )}
                    {!row.isPublished && !row.canPublish ? (
                      <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">
                        {row.publishBlockers[0]}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {row.slug ? (
                        <Button asChild variant="outline" className="min-h-11">
                          <Link
                            href={
                              serviceSlug
                                ? servicePath(
                                    serviceSlug,
                                    "municipalities",
                                    row.slug
                                  )
                                : `/admin/rules/regulatory/${row.slug}`
                            }
                          >
                            <BookOpen className="size-4" aria-hidden />
                            市の設定
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant={row.isPublished ? "outline" : "default"}
                        className="min-h-11"
                        disabled={
                          pending ||
                          (!row.isPublished && !row.canPublish) ||
                          !row.jurisdictionId
                        }
                        onClick={() => togglePublish(row)}
                      >
                        {pending ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : null}
                        {row.isPublished ? "停止する" : "運用する"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-base text-muted-foreground"
                  >
                    対象自治体がありません。自治体マスタをご確認ください。
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
