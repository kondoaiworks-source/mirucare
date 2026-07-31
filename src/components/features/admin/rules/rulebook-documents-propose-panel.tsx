"use client"

import Link from "next/link"
import { useTransition } from "react"
import { toast } from "sonner"
import { ExternalLink, FileText, Sparkles } from "lucide-react"
import { proposeAiCheckRulesFromDocumentAction } from "@/app/actions/propose-check-rules"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

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
}

/**
 * 判定ルール案の生成パネル。
 * URL登録だけでは案は出ない。人が明示的に生成する。
 */
export function RulebookDocumentsProposePanel({
  documents,
  citySlug,
  heading = "判定ルール案の生成",
  description = "台帳に本文がある資料から、AIが判定ルール案＋根拠を提案します。生成後は下の了承待ちで確認するまでチェックには使われません。",
  onProposed,
  hidePendingLink = false,
}: Props) {
  const [pending, startTransition] = useTransition()
  const generatable = documents.filter(
    (d) => d.hasTextSnapshot || Boolean(d.content_hash?.trim())
  )

  function afterSuccess(message: string, descriptionText?: string) {
    toast.success(message, {
      description:
        descriptionText ?? "了承するまで書類チェックには使われません。",
      duration: 10000,
    })
    onProposed?.()
  }

  function proposeOne(doc: ProposePanelDocument) {
    startTransition(async () => {
      const result = await proposeAiCheckRulesFromDocumentAction({
        knowledgeDocumentId: doc.id,
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
    })
  }

  function proposeAll() {
    if (generatable.length === 0) {
      toast.message(
        "生成できる資料がありません。PDF直リンクの登録と同期をご確認ください。"
      )
      return
    }
    startTransition(async () => {
      let total = 0
      let failures = 0
      for (const doc of generatable) {
        const result = await proposeAiCheckRulesFromDocumentAction({
          knowledgeDocumentId: doc.id,
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
    })
  }

  return (
    <section
      className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4 shadow-subtle"
      aria-labelledby="propose-rules-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            id="propose-rules-heading"
            className="text-lg font-semibold text-primary-dark"
          >
            {heading}
          </h2>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11"
            disabled={pending || generatable.length === 0}
            onClick={proposeAll}
          >
            <Sparkles className="size-4" aria-hidden />
            {pending
              ? "生成中…"
              : `まとめて判定ルール案を生成する（${generatable.length}件）`}
          </Button>
          {!hidePendingLink ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/admin/rules/pending">ルール管理で了承する</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {documents.length === 0 ? (
        <p className="text-base leading-relaxed text-muted-foreground">
          台帳上の資料がありません。国・県または市区町村ルール設定で公開情報PDF（直リンク）を登録してください。
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => {
            const url = d.source_url?.trim() || null
            const canGenerate =
              d.hasTextSnapshot || Boolean(d.content_hash?.trim())
            const layerKey = d.layer ?? "other"
            const subtitle = [
              LAYER_LABEL[layerKey] ?? d.jurisdiction_level,
              d.region_name,
              d.last_sync_status ? `同期:${d.last_sync_status}` : null,
            ]
              .filter(Boolean)
              .join("／")

            return (
              <li key={d.id}>
                <Card className="rounded-xl shadow-subtle">
                  <CardContent className="flex flex-wrap items-center gap-3 py-3">
                    <FileText
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-primary-dark">{d.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
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
                    <div className="flex flex-wrap gap-2">
                      {url ? (
                        <Button asChild variant="outline" className="min-h-11">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            原文を開く
                            <ExternalLink className="size-4" aria-hidden />
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-11"
                        disabled={pending || !canGenerate}
                        onClick={() => proposeOne(d)}
                      >
                        <Sparkles className="size-4" aria-hidden />
                        {pending ? "生成中…" : "判定ルール案を生成する"}
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
