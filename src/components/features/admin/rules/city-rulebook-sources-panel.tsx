"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  archiveRuleSourceUrlAction,
  createMunicipalitySourceUrlAction,
  updateRuleSourceUrlAction,
} from "@/app/actions/rule-engine"
import type { CityRulebookSource } from "@/app/actions/city-rulebook"
import {
  HUMAN_REVIEW_STATUS_LABEL,
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABEL,
  SOURCE_URL_DIRECT_FILE_HINT,
  SOURCE_URL_MONITORING_ALERT_BODY,
  SOURCE_URL_MONITORING_ALERT_TITLE,
  primarySourceUrl,
} from "@/lib/rule-engine/source-urls"
import type { RuleMaterialCategory } from "@/types/database"
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
  Info,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

export type SourceLayer = "national" | "prefecture" | "city"

const LAYER_BADGE: Record<SourceLayer, string> = {
  national: "国",
  prefecture: "県",
  city: "市",
}

type Props = {
  /** 表示用のレイヤ名（例：国、神奈川県、横浜市） */
  layerLabel: string
  layer: SourceLayer
  jurisdictionId: string | null
  sources: CityRulebookSource[]
  /** 折りたたみ内など。監視注意は先頭レイヤだけ出すときに false */
  showMonitoringAlert?: boolean
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
 * 市ルールブック「自治体ルール設定」内で、国／県／市の公開情報を
 * 追加・修正・削除（無効化）する。
 */
export function CityRulebookSourcesPanel({
  layerLabel,
  layer,
  jurisdictionId,
  sources,
  showMonitoringAlert = true,
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

  const canManage = Boolean(jurisdictionId)

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
    if (!jurisdictionId) return
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
      const monitorMessage =
        result.data?.monitorMessage ?? "公開情報を追加しました。"
      toast.success(monitorMessage, {
        description: result.data?.monitoringReady
          ? "以降の変更は自動で監視します。差分があれば更新アラートに出ます。"
          : "公開情報PDFの直リンクを入れると自動監視が始まります。",
        duration: 10000,
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
      toast.success("公開情報を更新しました。")
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

  function onDelete(source: CityRulebookSource) {
    const ok = window.confirm(
      `「${source.title}」を一覧から外しますか？\n（無効化します。必要ならあとから管理者向け画面で戻せます）`
    )
    if (!ok) return
    startTransition(async () => {
      const result = await archiveRuleSourceUrlAction({ id: source.id })
      if (!result.ok) {
        toast.error(result.error ?? "削除に失敗しました。")
        return
      }
      toast.success("公開情報を一覧から外しました。")
      if (editing?.id === source.id) setEditing(null)
      refresh()
    })
  }

  return (
    <section className="space-y-3" aria-label={`${layerLabel}の公開情報`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-primary-dark">
          公開情報（{LAYER_BADGE[layer]}）
        </p>
        <Button
          type="button"
          variant={showAdd ? "default" : "outline"}
          className="min-h-11"
          disabled={pending || !canManage}
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
              公開情報を追加する
            </>
          )}
        </Button>
      </div>

      {!canManage ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4 text-base text-muted-foreground">
          この層の自治体マスタがまだありません。自治体マスタをご確認ください。
        </p>
      ) : null}

      {showMonitoringAlert ? (
        <Alert className="rounded-xl border-accent/40 bg-accent/5">
          <Info className="text-accent" aria-hidden />
          <AlertTitle className="text-base text-primary-dark">
            {SOURCE_URL_MONITORING_ALERT_TITLE}
          </AlertTitle>
          <AlertDescription className="text-base leading-relaxed text-foreground/90">
            {SOURCE_URL_MONITORING_ALERT_BODY}
          </AlertDescription>
        </Alert>
      ) : null}

      {showAdd && canManage ? (
        <Card className="rounded-xl border-primary/20 bg-primary/[0.02] shadow-subtle">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg text-primary-dark">
              {layerLabel}の公開情報を追加
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              公式の公開情報PDF（直リンク）または公開情報リンク（HTML）を登録します。チェックに使うルールは「判定ルール案を生成→了承」が必要です。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`new-source-title-${layer}`}>資料名</Label>
              <Input
                id={`new-source-title-${layer}`}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="例：訪問介護 実地指導マニュアル"
                className="min-h-11 text-base"
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`new-source-category-${layer}`}>資料の種類</Label>
              <Select
                value={newCategory}
                onValueChange={(v) =>
                  setNewCategory(v as RuleMaterialCategory)
                }
                disabled={pending}
              >
                <SelectTrigger
                  id={`new-source-category-${layer}`}
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
              <Label htmlFor={`new-parent-url-${layer}`}>
                公開情報リンク（HTML・一覧ページ可）
              </Label>
              <Input
                id={`new-parent-url-${layer}`}
                type="url"
                value={newParentUrl}
                onChange={(e) => setNewParentUrl(e.target.value)}
                placeholder="https://..."
                className="min-h-11 text-base"
                disabled={pending}
              />
              <p className="text-sm leading-relaxed text-muted-foreground">
                根拠の所在を残すためのURLです。これだけでは自動監視が始まらないことがあります。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`new-direct-url-${layer}`}>
                公開情報PDF（直接URL・自動監視用・推奨）
              </Label>
              <Input
                id={`new-direct-url-${layer}`}
                type="url"
                value={newDirectUrl}
                onChange={(e) => setNewDirectUrl(e.target.value)}
                placeholder="https://.../*.pdf"
                className="min-h-11 text-base"
                disabled={pending}
              />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {SOURCE_URL_DIRECT_FILE_HINT}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`new-memo-${layer}`}>メモ（任意）</Label>
              <Input
                id={`new-memo-${layer}`}
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
              {layerLabel}の公開情報に追加する
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {sources.length === 0 && !showAdd ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4 text-base text-muted-foreground">
          まだ公開情報がありません。「公開情報を追加する」から入れてください。
        </p>
      ) : (
        <ul className="space-y-2">
          {sources.map((s) => {
            const url = primarySourceUrl(s)
            const isEditing = editing?.id === s.id
            const needsAttention =
              s.human_review_status === "needs_review" ||
              s.human_review_status === "outdated" ||
              s.human_review_status === "unverified" ||
              !url
            return (
              <li key={s.id}>
                <Card
                  className={
                    needsAttention
                      ? "rounded-xl border-warning/40 shadow-subtle"
                      : "rounded-xl shadow-subtle"
                  }
                >
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
                          公開情報リンク（HTML・一覧ページ可）
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
                          公開情報PDF（直接URL・自動監視用・推奨）
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
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {SOURCE_URL_DIRECT_FILE_HINT}
                        </p>
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
                        {LAYER_BADGE[layer]}
                      </Badge>
                      {needsAttention ? (
                        <Badge variant="destructive" className="rounded-md">
                          {!url ? "URLなし／要修正" : "要確認"}
                        </Badge>
                      ) : null}
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
                          variant={needsAttention ? "default" : "outline"}
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={pending}
                          onClick={() => onDelete(s)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          削除する
                        </Button>
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
