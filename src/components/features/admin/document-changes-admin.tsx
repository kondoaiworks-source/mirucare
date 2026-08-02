"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { toast } from "@/components/ui/sonner"
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
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  approveChangeDraftAction,
  listPendingChangeDraftsAction,
  rejectChangeDraftAction,
  type PendingChangeDraftRow,
} from "@/app/actions/knowledge-change-drafts"
import { proposeAiCheckRulesFromDraftAction } from "@/app/actions/propose-check-rules"
import type { KnowledgeChangeItem } from "@/lib/knowledge/diff-draft"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"

function asChanges(raw: unknown): KnowledgeChangeItem[] {
  if (!Array.isArray(raw)) return []
  return raw as KnowledgeChangeItem[]
}

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function needsReview(draft: PendingChangeDraftRow): boolean {
  if (!draft.ai_organized) return true
  if (draft.quote_verified_ratio == null) return true
  return Number(draft.quote_verified_ratio) < 1
}

function isTruncated(draft: PendingChangeDraftRow): boolean {
  return Boolean(
    draft.before_snapshot?.is_truncated || draft.after_snapshot?.is_truncated
  )
}

export function DocumentChangesAdmin() {
  const searchParams = useSearchParams()
  const citySlug = searchParams.get("city")
  const draftFocusId = searchParams.get("draft")
  const cityFromQuery = citySlug ? getPhase1CityBySlug(citySlug) : undefined

  const [drafts, setDrafts] = useState<PendingChangeDraftRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await listPendingChangeDraftsAction()
      if (!result.ok) {
        setLoadError(
          result.error ??
            "一覧を取得できませんでした。マイグレーション適用をご確認ください。"
        )
        setDrafts([])
      } else {
        setDrafts(result.data?.drafts ?? [])
      }
    } catch {
      setLoadError("一覧を取得できませんでした。")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!draftFocusId) return
    const el = document.getElementById(`draft-card-${draftFocusId}`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [draftFocusId, drafts])

  const visibleDrafts = useMemo(() => {
    if (!cityFromQuery) return drafts
    const name = cityFromQuery.name
    const pref = cityFromQuery.prefectureName
    return drafts.filter((d) => {
      const doc = d.knowledge_documents
      if (!doc) return false
      if (doc.jurisdiction_level === "国") return true
      if (
        doc.jurisdiction_level === "都道府県" &&
        (doc.region_name === pref || doc.region_name?.includes(pref))
      ) {
        return true
      }
      if (
        doc.jurisdiction_level === "市区町村" &&
        (doc.region_name === name || doc.region_name?.includes(name))
      ) {
        return true
      }
      return false
    })
  }, [drafts, cityFromQuery])

  function setReason(id: string, value: string) {
    setReasons((prev) => ({ ...prev, [id]: value }))
  }

  function onApprove(draft: PendingChangeDraftRow) {
    const reason = (reasons[draft.id] ?? "").trim()
    startTransition(async () => {
      const result = await approveChangeDraftAction({
        draftId: draft.id,
        reviewReason: reason,
      })
      if (!result.ok) {
        toast.error(result.error ?? "承認に失敗しました。")
        return
      }
      toast.success("台帳に反映しました", {
        description:
          "続けて「判定ルール案を生成する」と、差分からチェック用ルール案がルール管理に載ります。",
        duration: 10000,
      })
      setReasons((prev) => {
        const next = { ...prev }
        delete next[draft.id]
        return next
      })
      await refresh()
    })
  }

  function onProposeRules(draft: PendingChangeDraftRow) {
    startTransition(async () => {
      const result = await proposeAiCheckRulesFromDraftAction({
        draftId: draft.id,
      })
      if (!result.ok) {
        toast.error(result.error ?? "判定ルール案の生成に失敗しました。")
        return
      }
      if (result.data?.empty) {
        toast.message("AIは判定ルール案を出しませんでした。原文をご確認ください。")
        return
      }
      toast.success(
        `判定ルール案を ${result.data?.createdCount ?? 0}件、ルール管理に載せました。`,
        {
          description: "了承するまで書類チェックには使われません。",
          action: {
            label: "ルール管理を開く",
            onClick: () => {
              window.location.href = "/admin/rules/pending"
            },
          },
          duration: 12000,
        }
      )
    })
  }

  function onReject(draft: PendingChangeDraftRow) {
    const reason = (reasons[draft.id] ?? "").trim()
    startTransition(async () => {
      const result = await rejectChangeDraftAction({
        draftId: draft.id,
        reviewReason: reason,
      })
      if (!result.ok) {
        toast.error(result.error ?? "差し戻しに失敗しました。")
        return
      }
      toast.success("差し戻しました。")
      setReasons((prev) => {
        const next = { ...prev }
        delete next[draft.id]
        return next
      })
      await refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-primary-dark">
            マニュアル変更の承認
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            監視で検知した変更を確認し、問題なければ<strong>公開情報監視</strong>
            へ反映します。チェック用の判定ルールは、差分から
            <strong>判定ルール案を生成</strong>
            し、ルール管理で了承してから使います。
          </p>
          {cityFromQuery ? (
            <p className="text-base font-medium text-primary">
              {cityFromQuery.name}
              のルールブック関連（国・県・市）に絞り込み中。
              <Link
                href={`/admin/rules/regulatory/${cityFromQuery.slug}`}
                className="ml-2 underline-offset-4 hover:underline"
              >
                ルールブックに戻る
              </Link>
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={loading || pending}
          onClick={() => void refresh()}
          className="min-h-11"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          一覧を更新する
        </Button>
      </div>

      {loadError ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みに失敗しました</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-base tabular-nums text-muted-foreground">
        差分承認待ち{" "}
        <span className="text-2xl font-bold text-primary-dark">
          {visibleDrafts.length}
        </span>{" "}
        件
        {cityFromQuery && drafts.length !== visibleDrafts.length ? (
          <span className="ml-2 text-sm">（全体 {drafts.length}件）</span>
        ) : null}
      </p>

      <Alert className="rounded-xl border-primary/20 bg-primary/[0.03]">
        <CheckCircle2 className="text-primary" />
        <AlertTitle>辞書反映は2段階です</AlertTitle>
        <AlertDescription className="space-y-2 text-base leading-relaxed">
          <p>
            ①この画面の承認＝公開情報監視の<strong>版履歴</strong>への反映。
            ②チェック用の判定ルールは「判定ルール案を生成する」→
            <strong>ルール管理</strong>
            で了承して初めて使われます（自動では載りません）。
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/admin/rules/pending">ルール管理を開く</Link>
          </Button>
        </AlertDescription>
      </Alert>

      {loading && drafts.length === 0 ? (
        <p className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          読み込み中…
        </p>
      ) : null}

      {!loading && visibleDrafts.length === 0 && !loadError ? (
        <Card className="rounded-xl shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">差分承認待ちはありません</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              {cityFromQuery
                ? `${cityFromQuery.name}関連のマニュアル差分はありません。`
                : "変更が検知されると、ここに確認案件が表示されます。"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <ul className="space-y-6">
        {visibleDrafts.map((draft) => {
          const doc = draft.knowledge_documents
          const changes = asChanges(draft.changes)
          const reviewNeeded = needsReview(draft)
          const truncated = isTruncated(draft)
          const focused = draftFocusId === draft.id

          return (
            <li key={draft.id} id={`draft-card-${draft.id}`}>
              <Card
                className={cn(
                  "rounded-xl shadow-subtle",
                  focused && "ring-2 ring-primary"
                )}
              >
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-xl text-primary-dark">
                        {doc?.title ?? "（マニュアル名不明）"}
                      </CardTitle>
                      <CardDescription className="text-base leading-relaxed">
                        変更検知: {formatDateTime(draft.created_at)}
                        {doc
                          ? ` ／ ${doc.applicable_year}年度${doc.region_name ? `・${doc.region_name}` : ""}`
                          : null}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {reviewNeeded ? (
                        <Badge
                          variant="destructive"
                          className="h-7 gap-1 rounded-lg px-2.5 text-sm"
                        >
                          <AlertTriangle className="size-3.5" aria-hidden />
                          要精査
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="h-7 gap-1 rounded-lg px-2.5 text-sm"
                        >
                          <CheckCircle2 className="size-3.5" aria-hidden />
                          引用検証済
                        </Badge>
                      )}
                      {!draft.ai_organized ? (
                        <Badge
                          variant="outline"
                          className="h-7 gap-1 rounded-lg px-2.5 text-sm"
                        >
                          <FileWarning className="size-3.5" aria-hidden />
                          AI整理なし
                        </Badge>
                      ) : null}
                      {truncated ? (
                        <Badge
                          variant="outline"
                          className="h-7 gap-1 rounded-lg border-warning/40 px-2.5 text-sm text-warning"
                        >
                          <AlertTriangle className="size-3.5" aria-hidden />
                          全文一部未取得
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted/60 p-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      AI要約
                    </p>
                    <p className="mt-1 text-base leading-relaxed text-foreground">
                      {draft.ai_summary ?? "（要約なし）"}
                    </p>
                    {draft.quote_verified_ratio != null ? (
                      <p className="mt-2 text-sm tabular-nums text-muted-foreground">
                        引用一致率:{" "}
                        {Math.round(Number(draft.quote_verified_ratio) * 100)}%
                      </p>
                    ) : null}
                  </div>

                  {truncated ? (
                    <Alert className="rounded-xl border-warning/30 bg-warning/5">
                      <AlertTriangle className="text-warning" />
                      <AlertTitle>全文一部未取得</AlertTitle>
                      <AlertDescription>
                        テキストが長いため一部のみ保存されています。判断精度に影響する可能性がありますので、原文PDFもあわせてご確認ください。
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </CardHeader>

                <CardContent className="space-y-4">
                  {changes.length === 0 ? (
                    <p className="text-base leading-relaxed text-muted-foreground">
                      対比案はありません。変更前後の原文スナップショットをご確認ください。
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {changes.map((change, idx) => {
                        const itemNeedsReview =
                          change.quote_before_verified === false ||
                          change.quote_after_verified === false
                        return (
                          <li
                            key={`${draft.id}-${idx}`}
                            className="space-y-2 rounded-xl border border-border p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="rounded-lg">
                                {change.change_type || "変更"}
                              </Badge>
                              {itemNeedsReview ? (
                                <Badge
                                  variant="destructive"
                                  className="rounded-lg"
                                >
                                  要精査
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="rounded-lg"
                                >
                                  引用検証済
                                </Badge>
                              )}
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div
                                className={cn(
                                  "rounded-xl p-3 text-base leading-relaxed",
                                  "bg-danger/5 ring-1 ring-danger/20"
                                )}
                              >
                                <p className="mb-1 text-sm font-medium text-danger">
                                  変更前
                                </p>
                                <p className="whitespace-pre-wrap">
                                  {change.before_text || "（なし）"}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "rounded-xl p-3 text-base leading-relaxed",
                                  "bg-primary/5 ring-1 ring-primary/20"
                                )}
                              >
                                <p className="mb-1 text-sm font-medium text-primary">
                                  変更後
                                </p>
                                <p className="whitespace-pre-wrap">
                                  {change.after_text || "（なし）"}
                                </p>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor={`reason-${draft.id}`}
                      className="text-base"
                    >
                      確認記録（承認・差し戻し共通）
                      {reviewNeeded ? (
                        <span className="ml-1 text-danger">※要精査は必須</span>
                      ) : null}
                    </Label>
                    <textarea
                      id={`reason-${draft.id}`}
                      value={reasons[draft.id] ?? ""}
                      onChange={(e) => setReason(draft.id, e.target.value)}
                      rows={3}
                      className="min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-base leading-relaxed shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      placeholder="例：公式PDFの該当箇所を目視確認し、差分に問題がないことを確認しました。"
                      disabled={pending}
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Button
                      type="button"
                      size="lg"
                      className="min-h-11"
                      disabled={pending}
                      onClick={() => onApprove(draft)}
                    >
                      <CheckCircle2 className="size-4" aria-hidden />
                      承認して台帳へ反映する
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="min-h-11"
                      disabled={pending}
                      onClick={() => onReject(draft)}
                    >
                      <XCircle className="size-4" aria-hidden />
                      差し戻す
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="secondary"
                      className="min-h-11"
                      disabled={pending}
                      onClick={() => onProposeRules(draft)}
                    >
                      判定ルール案を生成する
                    </Button>
                    <Button asChild size="lg" variant="ghost" className="min-h-11">
                      <Link href="/admin/rules/pending">ルール管理を開く</Link>
                    </Button>
                    <Button asChild size="lg" variant="ghost" className="min-h-11">
                      <Link
                        href={`/admin/rules/ai-rules?fromDraft=${draft.id}`}
                      >
                        手入力で改訂案を作る
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
