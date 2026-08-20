"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import {
  archiveRuleSourceUrlAction,
  createMunicipalitySourceUrlAction,
  resyncRuleSourceTextAction,
  updateRuleSourceUrlAction,
} from "@/app/actions/rule-engine"
import type { CityRulebookSource } from "@/app/actions/city-rulebook"
import {
  HUMAN_REVIEW_STATUS_LABEL,
  SOURCE_URL_DIRECT_FILE_HINT,
  SOURCE_URL_FIX_HINT,
  SOURCE_URL_MONITORING_ALERT_BODY,
  SOURCE_URL_MONITORING_ALERT_TITLE,
  isLinkCollectionSource,
  isReadablePdfSource,
  primarySourceUrl,
  sourceNeedsPdfTextFix,
} from "@/lib/rule-engine/source-urls"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import { cn } from "@/lib/utils"
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
  CheckCircle2,
  ExternalLink,
  FileWarning,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  BookPlus,
  X,
} from "lucide-react"

export type SourceLayer = "national" | "prefecture" | "city"
type RegisterKind = "pdf" | "html"

const LAYER_BADGE: Record<SourceLayer, string> = {
  national: "国",
  prefecture: "県",
  city: "市",
}

type Props = {
  layerLabel: string
  layer: SourceLayer
  jurisdictionId: string | null
  sources: CityRulebookSource[]
  showMonitoringAlert?: boolean
  /** 根拠情報からルールブック作成へ進む */
  composeHref?: string | null
  onChanged?: () => void
}

type EditDraft = {
  id: string
  title: string
  kind: RegisterKind
  url: string
  memo: string
}

function kindOf(source: CityRulebookSource): RegisterKind {
  return isReadablePdfSource(source) ? "pdf" : "html"
}

function urlOf(source: CityRulebookSource): string {
  if (kindOf(source) === "pdf") {
    return (
      source.direct_file_url?.trim() ||
      primarySourceUrl(source) ||
      ""
    )
  }
  return (
    source.parent_page_url?.trim() ||
    primarySourceUrl(source) ||
    ""
  )
}

/**
 * 根拠情報の国／県／市。読むPDFと参考リンク（HTML）を分けて置く。
 */
export function CityRulebookSourcesPanel({
  layerLabel,
  layer,
  jurisdictionId,
  sources,
  showMonitoringAlert = true,
  composeHref,
  onChanged,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<EditDraft | null>(null)

  const [newTitle, setNewTitle] = useState("")
  const [newKind, setNewKind] = useState<RegisterKind>("pdf")
  const [newUrl, setNewUrl] = useState("")
  const [newMemo, setNewMemo] = useState("")

  const canManage = Boolean(jurisdictionId)
  const pdfSources = sources.filter((s) => isReadablePdfSource(s))
  const linkSources = sources.filter((s) => isLinkCollectionSource(s))

  function notifyMonitor(opts: {
    kind: RegisterKind
    message: string
    synced?: boolean
    description: string
  }) {
    const failed = opts.kind === "pdf" && opts.synced === false
    const toastFn = failed ? toast.error : toast.success
    toastFn(opts.message, {
      description: failed
        ? "本文なしのままです。「本文を取り直す」からやり直せます。"
        : opts.description,
      duration: 10000,
    })
  }

  function refresh() {
    onChanged?.()
    router.refresh()
  }

  function startEdit(source: CityRulebookSource) {
    setShowAdd(false)
    setEditing({
      id: source.id,
      title: source.title,
      kind: kindOf(source),
      url: urlOf(source),
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
        kind: newKind,
        url: newUrl,
        memo: newMemo,
      })
      if (!result.ok) {
        toast.error(result.error ?? "登録に失敗しました。")
        return
      }
      const monitorMessage =
        result.data?.monitorMessage ?? "資料を追加しました。"
      notifyMonitor({
        kind: newKind,
        message: monitorMessage,
        synced: result.data?.synced,
        description:
          newKind === "pdf" && result.data?.monitoringReady
            ? "以降の変更は自動で監視します。変わったら監視状況からルールブックを作り直してください。"
            : newKind === "pdf"
              ? "PDFの直リンクだと本文の取得が始まります。"
              : "リンク集に載せました。ルール抽出には使いません。",
      })
      setNewTitle("")
      setNewUrl("")
      setNewMemo("")
      setNewKind("pdf")
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
        kind: editing.kind,
        url: editing.url,
        memo: editing.memo,
      })
      if (!result.ok) {
        toast.error(result.error ?? "保存に失敗しました。")
        return
      }
      notifyMonitor({
        kind: editing.kind,
        message: result.data?.monitorMessage ?? "リンクを更新しました。",
        synced: result.data?.synced,
        description:
          editing.kind === "pdf"
            ? "本文が取れたら、ルールブック作成から下書きを作り直してください。"
            : "リンク集の参考リンクとして保存しました。",
      })
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
      toast.success("根拠情報から外しました。")
      if (editing?.id === source.id) setEditing(null)
      refresh()
    })
  }

  function onResync(source: CityRulebookSource) {
    startTransition(async () => {
      const result = await resyncRuleSourceTextAction(source.id)
      if (!result.ok) {
        toast.error(result.error ?? "本文の取り直しに失敗しました。")
        return
      }
      notifyMonitor({
        kind: "pdf",
        message: result.data?.message ?? "本文の取り直しが終わりました。",
        synced: result.data?.synced,
        description: "本文ありが付けば、ルールブック作成で使えます。",
      })
      refresh()
    })
  }

  return (
    <section
      id={`source-layer-${layer}`}
      className="space-y-4"
      aria-label={`${layerLabel}の根拠情報`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-primary-dark">
          {layerLabel}
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
              資料を追加する
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
              {layerLabel}に資料を追加
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              読むPDFか、参考のHTMLリンクかを選んでください。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">この資料はどれですか</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <KindButton
                  selected={newKind === "pdf"}
                  disabled={pending}
                  title="読むPDF"
                  hint="ルールブック作成のときに読みます"
                  onSelect={() => setNewKind("pdf")}
                />
                <KindButton
                  selected={newKind === "html"}
                  disabled={pending}
                  title="参考リンク（HTML）"
                  hint="リンク集に置きます"
                  onSelect={() => setNewKind("html")}
                />
              </div>
            </fieldset>
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
              <Label htmlFor={`new-source-url-${layer}`}>
                {newKind === "pdf" ? "PDFの直リンク" : "参考リンク（HTML）"}
              </Label>
              <Input
                id={`new-source-url-${layer}`}
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={
                  newKind === "pdf" ? "https://.../*.pdf" : "https://..."
                }
                className="min-h-11 text-base"
                disabled={pending}
              />
              {newKind === "pdf" ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {SOURCE_URL_DIRECT_FILE_HINT}
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  お知らせ一覧や案内ページです。人は開けますが、ルール抽出には使いません。
                </p>
              )}
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
              disabled={pending || !newTitle.trim() || !newUrl.trim()}
              onClick={onCreate}
            >
              {layerLabel}に追加する
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <SourceGroup
        heading="読む資料"
        variant="pdf"
        emptyText="読むPDFはまだありません。"
        sources={pdfSources}
        layer={layer}
        editing={editing}
        pending={pending}
        composeHref={composeHref}
        onStartEdit={startEdit}
        onSaveEdit={onSaveEdit}
        onCancelEdit={() => setEditing(null)}
        onChangeEdit={setEditing}
        onMarkVerified={onMarkVerified}
        onResync={onResync}
        onDelete={onDelete}
      />

      <SourceGroup
        heading="リンク集"
        variant="link"
        emptyText="参考リンクはまだありません。"
        sources={linkSources}
        layer={layer}
        editing={editing}
        pending={pending}
        composeHref={composeHref}
        onStartEdit={startEdit}
        onSaveEdit={onSaveEdit}
        onCancelEdit={() => setEditing(null)}
        onChangeEdit={setEditing}
        onMarkVerified={onMarkVerified}
        onResync={onResync}
        onDelete={onDelete}
      />
    </section>
  )
}

function KindButton({
  selected,
  disabled,
  title,
  hint,
  onSelect,
}: {
  selected: boolean
  disabled: boolean
  title: string
  hint: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-11 w-full flex-col items-start rounded-xl border px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/5 font-semibold text-primary-dark"
          : "border-border"
      )}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="text-base">{title}</span>
      <span className="mt-1 text-sm font-normal leading-relaxed text-muted-foreground">
        {hint}
      </span>
    </button>
  )
}

function SourceGroup({
  heading,
  variant,
  emptyText,
  sources,
  layer,
  editing,
  pending,
  composeHref,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onChangeEdit,
  onMarkVerified,
  onResync,
  onDelete,
}: {
  heading: string
  variant: "pdf" | "link"
  emptyText: string
  sources: CityRulebookSource[]
  layer: SourceLayer
  editing: EditDraft | null
  pending: boolean
  composeHref?: string | null
  onStartEdit: (source: CityRulebookSource) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onChangeEdit: (next: EditDraft) => void
  onMarkVerified: (id: string) => void
  onResync: (source: CityRulebookSource) => void
  onDelete: (source: CityRulebookSource) => void
}) {
  const isLinks = variant === "link"
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-primary-dark">{heading}</h3>
      {sources.length === 0 ? (
        <p className="text-base text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {sources.map((s) => {
            const url = primarySourceUrl(s)
            const isEditing = editing?.id === s.id
            const needsLinkFix = sourceNeedsPdfTextFix(s)
            const needsAttention =
              s.human_review_status === "needs_review" ||
              s.human_review_status === "outdated" ||
              !url ||
              needsLinkFix
            return (
              <li key={s.id}>
                <Card
                  className={
                    needsAttention
                      ? "rounded-xl border-accent/40 shadow-subtle"
                      : "rounded-xl shadow-subtle"
                  }
                >
                  {isEditing && editing ? (
                    <CardContent className="space-y-4 py-4">
                      {needsLinkFix ? (
                        <Alert className="rounded-xl border-accent/40 bg-accent/5">
                          <FileWarning className="text-accent" aria-hidden />
                          <AlertTitle className="text-base text-primary-dark">
                            本文がありません。リンク先を確認してください
                          </AlertTitle>
                          <AlertDescription className="text-base leading-relaxed">
                            {SOURCE_URL_FIX_HINT}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">
                          この資料はどれですか
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <KindButton
                            selected={editing.kind === "pdf"}
                            disabled={pending}
                            title="読むPDF"
                            hint="ルールブック作成のときに読みます"
                            onSelect={() =>
                              onChangeEdit({ ...editing, kind: "pdf" })
                            }
                          />
                          <KindButton
                            selected={editing.kind === "html"}
                            disabled={pending}
                            title="参考リンク（HTML）"
                            hint="リンク集に置きます"
                            onSelect={() =>
                              onChangeEdit({ ...editing, kind: "html" })
                            }
                          />
                        </div>
                      </fieldset>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-title-${s.id}`}>資料名</Label>
                        <Input
                          id={`edit-title-${s.id}`}
                          value={editing.title}
                          onChange={(e) =>
                            onChangeEdit({ ...editing, title: e.target.value })
                          }
                          className="min-h-11 text-base"
                          disabled={pending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-url-${s.id}`}>
                          {editing.kind === "pdf"
                            ? "PDFの直リンク"
                            : "参考リンク（HTML）"}
                        </Label>
                        <Input
                          id={`edit-url-${s.id}`}
                          type="url"
                          value={editing.url}
                          onChange={(e) =>
                            onChangeEdit({ ...editing, url: e.target.value })
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
                            onChangeEdit({ ...editing, memo: e.target.value })
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
                          onClick={onCancelEdit}
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
                      {isLinks ? (
                        <Badge variant="outline" className="rounded-md">
                          参考リンク
                        </Badge>
                      ) : s.hasText ? (
                        <Badge variant="outline" className="rounded-md">
                          本文あり
                        </Badge>
                      ) : (
                        <Badge
                          variant="destructive"
                          className="inline-flex items-center gap-1 rounded-md"
                        >
                          <FileWarning className="size-3.5" aria-hidden />
                          {!url ? "URLなし" : "本文なし"}
                        </Badge>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-primary-dark">
                          {s.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {s.jurisdictionName}
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
                        {needsLinkFix && url ? (
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-11"
                            disabled={pending}
                            onClick={() => onResync(s)}
                          >
                            <RefreshCw className="size-4" aria-hidden />
                            本文を取り直す
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant={needsLinkFix || !url ? "default" : "outline"}
                          size="sm"
                          className="min-h-11"
                          disabled={pending}
                          onClick={() => onStartEdit(s)}
                        >
                          <Pencil className="size-4" aria-hidden />
                          {needsLinkFix || !url ? "リンクを直す" : "修正する"}
                        </Button>
                        {composeHref ? (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="min-h-11"
                          >
                            <a href={composeHref}>
                              <BookPlus className="size-4" aria-hidden />
                              {RULES_UI.addToRulebook}
                            </a>
                          </Button>
                        ) : null}
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
    </div>
  )
}
