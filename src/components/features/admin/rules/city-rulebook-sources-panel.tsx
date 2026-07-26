"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createMunicipalitySourceUrlAction,
  updateRuleSourceUrlAction,
} from "@/app/actions/rule-engine"
import type { CityRulebookSource } from "@/app/actions/city-rulebook"
import {
  HUMAN_REVIEW_STATUS_LABEL,
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABEL,
  primarySourceUrl,
} from "@/lib/rule-engine/source-urls"
import type { RuleMaterialCategory } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Pencil,
  Plus,
  X,
} from "lucide-react"

type Props = {
  citySlug: string
  cityName: string
  jurisdictionId: string
  sources: CityRulebookSource[]
  /** 親の details 内など、外側見出しを出さない */
  embedded?: boolean
}

type EditDraft = {
  id: string
  title: string
  parentPageUrl: string
  directFileUrl: string
  materialCategory: RuleMaterialCategory
  memo: string
}

/**
 * 市ルールブック上で、この市の参照URLを追加・短い編集する。
 * 詳細項目は参照サイト画面へ。
 */
export function CityRulebookSourcesPanel({
  citySlug,
  cityName,
  jurisdictionId,
  sources,
  embedded = false,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<EditDraft | null>(null)

  const [newTitle, setNewTitle] = useState("")
  const [newParentUrl, setNewParentUrl] = useState("")
  const [newDirectUrl, setNewDirectUrl] = useState("")
  const [newCategory, setNewCategory] =
    useState<RuleMaterialCategory>("訪問介護")
  const [newMemo, setNewMemo] = useState("")

  function refresh() {
    router.refresh()
  }

  function startEdit(source: CityRulebookSource) {
    setShowAdd(false)
    setEditing({
      id: source.id,
      title: source.title,
      parentPageUrl: source.parent_page_url ?? "",
      directFileUrl: source.direct_file_url ?? "",
      materialCategory: source.material_category ?? "訪問介護",
      memo: source.memo ?? "",
    })
  }

  function onCreate() {
    startTransition(async () => {
      const result = await createMunicipalitySourceUrlAction({
        jurisdictionId,
        title: newTitle,
        serviceType: "訪問介護",
        materialCategory: newCategory,
        parentPageUrl: newParentUrl,
        directFileUrl: newDirectUrl,
        memo: newMemo,
      })
      if (!result.ok) {
        toast.error(result.error ?? "登録に失敗しました。")
        return
      }
      toast.success("参照URLを追加しました。", {
        description:
          "次に行政資料を登録（または同期）し、「判定ルール案を生成する」とルールブックの中身を提案できます。",
        action: {
          label: "行政資料を開く",
          onClick: () => {
            window.location.href = `/admin/rules/documents?city=${citySlug}`
          },
        },
        duration: 12000,
      })
      setNewTitle("")
      setNewParentUrl("")
      setNewDirectUrl("")
      setNewMemo("")
      setShowAdd(false)
      refresh()
    })
  }

  function onSaveEdit() {
    if (!editing) return
    startTransition(async () => {
      const result = await updateRuleSourceUrlAction({
        id: editing.id,
        title: editing.title,
        materialCategory: editing.materialCategory,
        parentPageUrl: editing.parentPageUrl,
        directFileUrl: editing.directFileUrl,
        memo: editing.memo,
      })
      if (!result.ok) {
        toast.error(result.error ?? "保存に失敗しました。")
        return
      }
      toast.success("参照URLを更新しました。")
      setEditing(null)
      refresh()
    })
  }

  function onMarkVerified(id: string) {
    startTransition(async () => {
      const result = await updateRuleSourceUrlAction({
        id,
        markVerified: true,
      })
      if (!result.ok) {
        toast.error(result.error ?? "確認記録に失敗しました。")
        return
      }
      toast.success("確認済みにしました。")
      refresh()
    })
  }

  return (
    <section
      className="space-y-3"
      aria-labelledby={embedded ? undefined : "city-sources-heading"}
    >
      {embedded ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={showAdd ? "default" : "outline"}
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              setEditing(null)
              setShowAdd((v) => !v)
            }}
          >
            {showAdd ? (
              <>
                <X className="size-4" aria-hidden />
                追加をやめる
              </>
            ) : (
              <>
                <Plus className="size-4" aria-hidden />
                参照URLを追加する
              </>
            )}
          </Button>
          <Button asChild variant="ghost" className="min-h-11">
            <Link href={`/admin/rules/source-urls?city=${citySlug}`}>
              詳細画面で編集する
            </Link>
          </Button>
        </div>
      ) : (
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="city-sources-heading"
            className="flex items-center gap-2 text-xl font-bold text-primary-dark"
          >
            <Link2 className="size-5 text-primary" aria-hidden />
            {cityName}の参照URL
          </h2>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            この市固有の公式ページ・資料URLです。追加したら、対応する行政資料を登録し「判定ルール案を生成する」へ進みます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={showAdd ? "default" : "outline"}
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              setEditing(null)
              setShowAdd((v) => !v)
            }}
          >
            {showAdd ? (
              <>
                <X className="size-4" aria-hidden />
                追加をやめる
              </>
            ) : (
              <>
                <Plus className="size-4" aria-hidden />
                参照URLを追加する
              </>
            )}
          </Button>
          <Button asChild variant="ghost" className="min-h-11">
            <Link href={`/admin/rules/source-urls?city=${citySlug}`}>
              詳細画面で編集する
            </Link>
          </Button>
        </div>
      </div>
      )}

      {showAdd ? (
        <Card className="rounded-xl border-primary/20 bg-primary/[0.02] shadow-subtle">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg text-primary-dark">
              {cityName}の参照URLを追加
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              公式ページまたはPDFのURLを登録します。登録だけではチェック基準になりません。行政資料化のあと「判定ルール案を生成→了承」が必要です。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-source-title">資料名</Label>
              <Input
                id="new-source-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="例：訪問介護 実地指導マニュアル"
                className="min-h-11 text-base"
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-source-category">資料の種類</Label>
              <Select
                value={newCategory}
                onValueChange={(v) =>
                  setNewCategory(v as RuleMaterialCategory)
                }
                disabled={pending}
              >
                <SelectTrigger
                  id="new-source-category"
                  className="min-h-11 text-base"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {MATERIAL_CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-parent-url">公式ページURL</Label>
              <Input
                id="new-parent-url"
                type="url"
                value={newParentUrl}
                onChange={(e) => setNewParentUrl(e.target.value)}
                placeholder="https://..."
                className="min-h-11 text-base"
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-direct-url">PDFなどの直接URL（任意）</Label>
              <Input
                id="new-direct-url"
                type="url"
                value={newDirectUrl}
                onChange={(e) => setNewDirectUrl(e.target.value)}
                placeholder="https://.../*.pdf"
                className="min-h-11 text-base"
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-memo">メモ（任意）</Label>
              <Input
                id="new-memo"
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                placeholder="どこを見たか短く"
                className="min-h-11 text-base"
                disabled={pending}
              />
            </div>
            <Button
              type="button"
              size="lg"
              className="min-h-11"
              disabled={pending || !newTitle.trim()}
              onClick={onCreate}
            >
              この市のルールブックに追加する
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {sources.length === 0 && !showAdd ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-base text-muted-foreground">
          まだ登録がありません。「参照URLを追加する」から入れてください。
        </p>
      ) : (
        <ul className="space-y-2">
          {sources.map((s) => {
            const url = primarySourceUrl(s)
            const isEditing = editing?.id === s.id
            return (
              <li key={s.id}>
                <Card className="rounded-xl shadow-subtle">
                  {isEditing && editing ? (
                    <CardContent className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-title-${s.id}`}>資料名</Label>
                        <Input
                          id={`edit-title-${s.id}`}
                          value={editing.title}
                          onChange={(e) =>
                            setEditing({ ...editing, title: e.target.value })
                          }
                          className="min-h-11 text-base"
                          disabled={pending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-cat-${s.id}`}>資料の種類</Label>
                        <Select
                          value={editing.materialCategory}
                          onValueChange={(v) =>
                            setEditing({
                              ...editing,
                              materialCategory: v as RuleMaterialCategory,
                            })
                          }
                          disabled={pending}
                        >
                          <SelectTrigger
                            id={`edit-cat-${s.id}`}
                            className="min-h-11 text-base"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MATERIAL_CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {MATERIAL_CATEGORY_LABEL[c]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-parent-${s.id}`}>
                          公式ページURL
                        </Label>
                        <Input
                          id={`edit-parent-${s.id}`}
                          type="url"
                          value={editing.parentPageUrl}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              parentPageUrl: e.target.value,
                            })
                          }
                          className="min-h-11 text-base"
                          disabled={pending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-direct-${s.id}`}>
                          PDFなどの直接URL（任意）
                        </Label>
                        <Input
                          id={`edit-direct-${s.id}`}
                          type="url"
                          value={editing.directFileUrl}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              directFileUrl: e.target.value,
                            })
                          }
                          className="min-h-11 text-base"
                          disabled={pending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-memo-${s.id}`}>メモ（任意）</Label>
                        <Input
                          id={`edit-memo-${s.id}`}
                          value={editing.memo}
                          onChange={(e) =>
                            setEditing({ ...editing, memo: e.target.value })
                          }
                          className="min-h-11 text-base"
                          disabled={pending}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="lg"
                          disabled={pending}
                          onClick={onSaveEdit}
                        >
                          保存する
                        </Button>
                        <Button
                          type="button"
                          size="lg"
                          variant="outline"
                          disabled={pending}
                          onClick={() => setEditing(null)}
                        >
                          やめる
                        </Button>
                      </div>
                    </CardContent>
                  ) : (
                    <CardContent className="flex flex-wrap items-center gap-3 py-4">
                      <Badge variant="outline" className="rounded-md">
                        市
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-primary-dark">
                          {s.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {s.jurisdictionName}
                          {s.material_category
                            ? `／${MATERIAL_CATEGORY_LABEL[s.material_category] ?? s.material_category}`
                            : ""}
                          ／
                          {HUMAN_REVIEW_STATUS_LABEL[s.human_review_status] ??
                            s.human_review_status}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {url ? (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="min-h-11"
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
                          <span className="self-center text-sm text-muted-foreground">
                            URL未設定
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11"
                          disabled={pending}
                          onClick={() => startEdit(s)}
                        >
                          <Pencil className="size-4" aria-hidden />
                          修正する
                        </Button>
                        {s.human_review_status !== "verified" ? (
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-11"
                            disabled={pending}
                            onClick={() => onMarkVerified(s.id)}
                          >
                            <CheckCircle2 className="size-4" aria-hidden />
                            確認済みにする
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
