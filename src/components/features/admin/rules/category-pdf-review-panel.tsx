"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { toast } from "@/components/ui/sonner"
import {
  addManualCategoryPdfCandidateAction,
  adoptCategoryPdfCandidateAction,
  discoverCategoryPdfCandidatesAction,
  getCategoryPdfBoardAction,
  rejectCategoryPdfCandidateAction,
  unlinkCategoryPdfAction,
  type CategoryPdfAdoptedRow,
  type CategoryPdfCandidateRow,
} from "@/app/actions/category-pdf"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"

type Props = {
  serviceSlug: string
  citySlug: string
  categorySlug: string
}

/**
 * 監査カテゴリの関連PDF：検索→確認→採用／不採用。
 */
export function CategoryPdfReviewPanel({
  serviceSlug,
  citySlug,
  categorySlug,
}: Props) {
  const [pending, setPending] = useState<CategoryPdfCandidateRow[]>([])
  const [adopted, setAdopted] = useState<CategoryPdfAdoptedRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, startTransition] = useTransition()
  const [showManual, setShowManual] = useState(false)
  const [manualTitle, setManualTitle] = useState("")
  const [manualParent, setManualParent] = useState("")
  const [manualDirect, setManualDirect] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getCategoryPdfBoardAction({
      serviceSlug,
      citySlug,
      categorySlug,
    })
    if (!result.ok || !result.data) {
      setError(
        result.error ??
          "関連PDFを読み込めませんでした。マイグレーション適用をご確認ください。"
      )
      setPending([])
      setAdopted([])
    } else {
      setPending(result.data.pending)
      setAdopted(result.data.adopted)
    }
    setLoading(false)
  }, [serviceSlug, citySlug, categorySlug])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function discover() {
    startTransition(async () => {
      const result = await discoverCategoryPdfCandidatesAction({
        serviceSlug,
        citySlug,
        categorySlug,
      })
      if (!result.ok) {
        toast.error(result.error ?? "検索に失敗しました。")
        return
      }
      const added = result.data?.added ?? 0
      toast.success(
        added > 0
          ? `${added}件の候補が見つかりました。内容を確認して採用／不採用を選んでください。`
          : "新しい候補はありませんでした。国・県・市の公開情報を登録してから再度お試しください。"
      )
      await refresh()
    })
  }

  function adopt(id: string) {
    startTransition(async () => {
      const result = await adoptCategoryPdfCandidateAction({ candidateId: id })
      if (!result.ok) {
        toast.error(result.error ?? "採用に失敗しました。")
        return
      }
      toast.success(result.data?.message ?? "採用しました。")
      await refresh()
    })
  }

  function reject(id: string) {
    startTransition(async () => {
      const result = await rejectCategoryPdfCandidateAction({
        candidateId: id,
      })
      if (!result.ok) {
        toast.error(result.error ?? "不採用に失敗しました。")
        return
      }
      toast.success("不採用にし、一覧から外しました。")
      await refresh()
    })
  }

  function unlink(sourceId: string) {
    startTransition(async () => {
      const result = await unlinkCategoryPdfAction({
        sourceId,
        categorySlug,
      })
      if (!result.ok) {
        toast.error(result.error ?? "解除に失敗しました。")
        return
      }
      toast.success("このカテゴリから外しました。")
      await refresh()
    })
  }

  function addManual() {
    startTransition(async () => {
      const result = await addManualCategoryPdfCandidateAction({
        serviceSlug,
        citySlug,
        categorySlug,
        title: manualTitle,
        parentPageUrl: manualParent,
        directFileUrl: manualDirect,
      })
      if (!result.ok) {
        toast.error(result.error ?? "追加に失敗しました。")
        return
      }
      toast.success("候補を追加しました。内容を確認して採用／不採用を選んでください。")
      setManualTitle("")
      setManualParent("")
      setManualDirect("")
      setShowManual(false)
      await refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11"
          disabled={busy || loading}
          onClick={discover}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
          関連PDFを検索する
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy}
          onClick={() => setShowManual((v) => !v)}
        >
          <Plus className="size-4" aria-hidden />
          URLを手で追加する
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy || loading}
          onClick={() => void refresh()}
        >
          再読み込み
        </Button>
      </div>

      <p className="text-base leading-relaxed text-muted-foreground">
        国・県・市に登録済みの公開情報から、このカテゴリに合いそうなものを候補にします。リンクで内容を確認し、「採用」で台帳監視を開始、「不採用」で一覧から外します。
      </p>

      {showManual ? (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div className="space-y-2">
            <Label htmlFor="manual-pdf-title">資料名</Label>
            <Input
              id="manual-pdf-title"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              className="min-h-11"
              placeholder="例：訪問介護計画書の取扱い"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-pdf-parent">親ページURL</Label>
            <Input
              id="manual-pdf-parent"
              value={manualParent}
              onChange={(e) => setManualParent(e.target.value)}
              className="min-h-11"
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-pdf-direct">PDF直リンク（推奨）</Label>
            <Input
              id="manual-pdf-direct"
              value={manualDirect}
              onChange={(e) => setManualDirect(e.target.value)}
              className="min-h-11"
              placeholder="https://....pdf"
            />
          </div>
          <Button
            type="button"
            className="min-h-11"
            disabled={busy}
            onClick={addManual}
          >
            候補に追加する
          </Button>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          読み込み中…
        </p>
      ) : (
        <>
          <section className="space-y-3" aria-labelledby="pdf-pending-heading">
            <h3
              id="pdf-pending-heading"
              className="text-base font-semibold text-primary-dark"
            >
              確認待ちの候補
              <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                （{pending.length}件）
              </span>
            </h3>
            {pending.length === 0 ? (
              <p className="text-base text-muted-foreground">
                候補はありません。「関連PDFを検索する」か、URLを手で追加してください。
              </p>
            ) : (
              <ul className="space-y-2">
                {pending.map((row) => {
                  const url = row.directFileUrl || row.parentPageUrl
                  return (
                    <li
                      key={row.id}
                      className="rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-primary-dark">
                            {row.title}
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {row.discoveryMethod === "manual"
                              ? "手動追加"
                              : "キーワード検索"}
                            {row.directFileUrl ? " ／ PDF" : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {url ? (
                            <Button
                              asChild
                              variant="outline"
                              className="min-h-11"
                            >
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                内容を確認する
                                <ExternalLink
                                  className="size-4"
                                  aria-hidden
                                />
                              </a>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            className="min-h-11"
                            disabled={busy}
                            onClick={() => adopt(row.id)}
                          >
                            <Check className="size-4" aria-hidden />
                            採用
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={busy}
                            onClick={() => reject(row.id)}
                          >
                            <X className="size-4" aria-hidden />
                            不採用
                          </Button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="pdf-adopted-heading">
            <h3
              id="pdf-adopted-heading"
              className="text-base font-semibold text-primary-dark"
            >
              採用済み（台帳監視の対象）
              <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                （{adopted.length}件）
              </span>
            </h3>
            {adopted.length === 0 ? (
              <p className="text-base text-muted-foreground">
                まだ採用した公開情報がありません。
              </p>
            ) : (
              <ul className="space-y-2">
                {adopted.map((row) => {
                  const url = row.directFileUrl || row.parentPageUrl
                  return (
                    <li
                      key={row.linkSourceId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-primary-dark">
                          {row.title}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-md">
                            {row.layerLabel}
                          </Badge>
                          {row.knowledgeDocumentId ? (
                            <Badge className="rounded-md bg-primary/15 text-primary-dark">
                              台帳登録済
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-md">
                              台帳未連携
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
                              開く
                              <ExternalLink className="size-4" aria-hidden />
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={busy}
                          onClick={() => unlink(row.linkSourceId)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          カテゴリから外す
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
