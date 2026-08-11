"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "@/components/ui/sonner"
import { ExternalLink, FileText, PencilLine, Sparkles } from "lucide-react"
import { proposeAiCheckRulesFromDocumentAction } from "@/app/actions/propose-check-rules"
import {
  checkRulesManagePath,
  checkRulesManualPath,
  type CheckRuleManageContext,
} from "@/lib/rule-engine/check-rule-scope"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** null=idle / "all"=一括 / 資料ID=その1件のみ */
type RunningTarget = null | "all" | string

const LAYER_LABEL: Record<string, string> = {
  national: "国",
  prefecture: "県",
  city: "市",
  other: "その他",
}

export type ProposePanelDocument = {
  id: string
  title: string
  region_name?: string | null
  jurisdiction_level?: string | null
  content_hash?: string | null
  source_url?: string | null
  last_sync_status?: string | null
  hasTextSnapshot: boolean
  layer?: string
}

type Props = {
  documents: ProposePanelDocument[]
  /** 公開情報監視への絞り込み用（省略可） */
  citySlug?: string
  heading?: string
  description?: string
  /** 生成後コールバック（了承一覧の再読込など） */
  onProposed?: () => void
  /** 同一ページに了承一覧があるとき、了承への誘導リンクを隠す */
  hidePendingLink?: boolean
  context: CheckRuleManageContext
}

const ACTION_BTN =
  "min-h-11 min-w-[10.5rem] justify-center sm:flex-1 sm:min-w-0"

/**
 * 判定ルール案の生成パネル。
 * 各資料に「原文を開く／AIで判定ルール生成／手動で判定ルール生成」を等配置。
 */
export function RulebookDocumentsProposePanel({
  documents,
  citySlug,
  heading = "ルール案を生成",
  description = "資料ごとに原文確認・AI生成・手動生成ができます。了承までチェックには使いません。",
  onProposed,
  hidePendingLink = false,
  context,
}: Props) {
  const [, startTransition] = useTransition()
  const [runningTarget, setRunningTarget] = useState<RunningTarget>(null)
  const generatable = documents.filter(
    (d) => d.hasTextSnapshot || Boolean(d.content_hash?.trim())
  )
  const isRunningAll = runningTarget === "all"
  const isAnyRunning = runningTarget !== null

  function afterSuccess(message: string, descriptionText?: string) {
    toast.success(message, {
      description:
        descriptionText ?? "了承するまで書類チェックには使われません。",
      duration: 10000,
    })
    onProposed?.()
  }

  function proposeOne(doc: ProposePanelDocument) {
    if (runningTarget) {
      toast.message(
        isRunningAll
          ? "まとめて生成中です。完了してからお試しください。"
          : "別の資料を生成中です。完了してからお試しください。"
      )
      return
    }
    setRunningTarget(doc.id)
    startTransition(async () => {
      try {
        const result = await proposeAiCheckRulesFromDocumentAction({
          knowledgeDocumentId: doc.id,
          scopeKind: context.scopeKind,
          jurisdictionId: context.jurisdictionId,
          citySlug: context.citySlug,
        })
        if (!result.ok) {
          toast.error(result.error ?? "判定ルール案の生成に失敗しました。")
          return
        }
        if (result.data?.empty) {
          toast.message(
            `「${doc.title}」から判定ルール案は出ませんでした。本文をご確認ください。`
          )
          return
        }
        afterSuccess(
          `「${doc.title}」から判定ルール案を ${result.data?.createdCount ?? 0}件載せました。`
        )
      } finally {
        setRunningTarget(null)
      }
    })
  }

  function proposeAll() {
    if (generatable.length === 0) {
      toast.message(
        "生成できる資料がありません。PDF直リンクの登録と同期をご確認ください。"
      )
      return
    }
    if (runningTarget) {
      toast.message("生成中です。完了してからお試しください。")
      return
    }
    setRunningTarget("all")
    startTransition(async () => {
      try {
        let total = 0
        let failures = 0
        for (const doc of generatable) {
          const result = await proposeAiCheckRulesFromDocumentAction({
            knowledgeDocumentId: doc.id,
            scopeKind: context.scopeKind,
            jurisdictionId: context.jurisdictionId,
            citySlug: context.citySlug,
          })
          if (!result.ok) {
            failures += 1
            continue
          }
          total += result.data?.createdCount ?? 0
        }
        if (total > 0) {
          afterSuccess(
            `判定ルール案を合計 ${total}件載せました。`,
            failures > 0
              ? `${failures}件は生成できませんでした。下の了承待ちをご確認ください。`
              : "下の了承待ちから確認してください。"
          )
        } else if (failures > 0) {
          toast.error(
            "判定ルール案を生成できませんでした。PDF直リンクと公開情報監視の同期をご確認ください。"
          )
        } else {
          toast.message("判定ルール案は出ませんでした。本文をご確認ください。")
        }
      } finally {
        setRunningTarget(null)
      }
    })
  }

  return (
    <section
      className={cn(
        "space-y-4",
        heading || description
          ? "rounded-xl border border-primary/20 bg-primary/[0.03] p-4 shadow-subtle"
          : undefined
      )}
      aria-labelledby={heading ? "propose-rules-heading" : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {heading || description ? (
          <div className="min-w-0 flex-1">
            {heading ? (
              <h2
                id="propose-rules-heading"
                className="text-lg font-semibold text-primary-dark"
              >
                {heading}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="sr-only">ルール生成</span>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11"
            disabled={isAnyRunning || generatable.length === 0}
            onClick={proposeAll}
          >
            <Sparkles className="size-4" aria-hidden />
            {isRunningAll
              ? "生成中…"
              : isAnyRunning
                ? "1件を生成中…"
                : "まとめてAIで生成"}
          </Button>
          {!hidePendingLink ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={checkRulesManagePath(context)}>判定ルール管理</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {documents.length === 0 ? (
        <p className="text-base leading-relaxed text-muted-foreground">
          資料がありません。根拠URL設定から登録してください。
        </p>
      ) : (
        <ul className="space-y-3">
          {documents.map((d) => {
            const url = d.source_url?.trim() || null
            const canGenerate =
              d.hasTextSnapshot || Boolean(d.content_hash?.trim())
            const isRunningThis = runningTarget === d.id
            const layerKey = d.layer ?? "other"
            const subtitle = [
              LAYER_LABEL[layerKey] ?? d.jurisdiction_level,
              d.region_name,
              d.last_sync_status ? `同期:${d.last_sync_status}` : null,
            ]
              .filter(Boolean)
              .join("／")
            const manualHref = checkRulesManualPath(context)

            return (
              <li key={d.id}>
                <Card className="rounded-xl shadow-subtle">
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <FileText
                        className="mt-1 size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 font-medium text-primary-dark">
                          {d.title}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                          {subtitle}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="rounded-md">
                            {LAYER_LABEL[layerKey] ??
                              d.jurisdiction_level ??
                              "資料"}
                          </Badge>
                          {d.hasTextSnapshot ? (
                            <Badge className="rounded-md bg-primary/15 text-primary-dark">
                              本文あり
                            </Badge>
                          ) : d.content_hash ? (
                            <Badge variant="outline" className="rounded-md">
                              再同期で補完します
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-md">
                              同期が必要
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex flex-col gap-2 sm:flex-row"
                      role="group"
                      aria-label={`${d.title}の操作`}
                    >
                      {url ? (
                        <Button
                          asChild
                          variant="outline"
                          className={cn(ACTION_BTN)}
                        >
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            原文を開く
                            <ExternalLink className="size-4" aria-hidden />
                          </a>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(ACTION_BTN)}
                          disabled
                        >
                          原文を開く
                          <ExternalLink className="size-4" aria-hidden />
                        </Button>
                      )}
                      <Button
                        type="button"
                        className={cn(ACTION_BTN)}
                        disabled={
                          !canGenerate || isRunningThis || isRunningAll
                        }
                        onClick={() => proposeOne(d)}
                      >
                        <Sparkles className="size-4" aria-hidden />
                        {isRunningThis
                          ? "AI生成中…"
                          : isRunningAll
                            ? "まとめて生成中…"
                            : "AIで生成"}
                      </Button>
                      <Button
                        asChild
                        variant="secondary"
                        className={cn(ACTION_BTN)}
                      >
                        <Link href={manualHref}>
                          <PencilLine className="size-4" aria-hidden />
                          手動で生成
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-sm leading-relaxed text-muted-foreground">
        うまくいかないときは
        <Link
          href={
            citySlug
              ? `/admin/rules/documents?city=${citySlug}`
              : "/admin/rules/documents"
          }
          className="mx-1 font-medium text-primary underline-offset-2 hover:underline"
        >
          公開情報監視
        </Link>
        で同期結果をご確認ください。
      </p>
    </section>
  )
}
