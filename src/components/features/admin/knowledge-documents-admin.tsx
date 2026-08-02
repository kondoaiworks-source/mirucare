"use client"

import { useCallback, useEffect, useMemo, useState, useTransition, type FormEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useDropzone } from "react-dropzone"
import {
  Archive,
  Check,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Upload,
  X,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  archiveKnowledgeDocumentAction,
  listKnowledgeDocumentsAction,
  listOpenKnowledgeSyncAlertsAction,
  registerKnowledgeDocumentAction,
  resolveKnowledgeSyncAlertAction,
  runKnowledgeSyncNowAction,
} from "@/app/actions/knowledge-documents"
import { listPendingChangeDraftsAction } from "@/app/actions/knowledge-change-drafts"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"
import {
  buildLinkageMonitorEvents,
  linkageResultLabel,
  type LinkageMonitorEvent,
  type LinkageMonitorResult,
  type PendingDraftForMonitor,
} from "@/lib/rule-engine/linkage-monitoring"
import type {
  JurisdictionLevel,
  KnowledgeDocument,
  KnowledgeSyncAlert,
  KnowledgeWatchKind,
} from "@/types/database"

const MONITOR_PREVIEW_LIMIT = 5

function formatMonitorDt(iso: string | null | undefined) {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function monitorResultBadgeClass(result: LinkageMonitorResult) {
  switch (result) {
    case "ok":
      return "border-primary/30 bg-primary/10 text-primary-dark"
    case "ng":
      return "border-danger/40 bg-danger/10 text-danger"
    case "diff":
      return "border-warning/40 bg-warning/10 text-warning"
  }
}

const JURISDICTION_OPTIONS: {
  value: JurisdictionLevel
  label: string
  hint: string
}[] = [
  { value: "国", label: "国", hint: "全国共通の基準・通知" },
  {
    value: "都道府県",
    label: "都道府県",
    hint: "例：神奈川県の実地指導マニュアル",
  },
  {
    value: "市区町村",
    label: "市区町村",
    hint: "例：横浜市のローカル運用",
  },
]

function defaultFiscalYear() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return month >= 4 ? year : year - 1
}

function syncStatusLabel(status: KnowledgeDocument["last_sync_status"]) {
  switch (status) {
    case "ok":
      return "更新反映"
    case "unchanged":
      return "変更なし"
    case "failed":
      return "失敗の可能性"
    case "suspicious":
      return "要確認"
    case "selector_broken":
      return "セレクタ破損"
    default:
      return "未チェック"
  }
}

function watchKindLabel(kind: KnowledgeDocument["watch_kind"]) {
  return kind === "index" ? "一覧監視" : "PDF直リンク"
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

export function KnowledgeDocumentsAdmin(props?: {
  /** 親ページで見出し・パンくずを出す場合は true */
  hidePageHeader?: boolean
}) {
  const hidePageHeader = props?.hidePageHeader ?? false
  const searchParams = useSearchParams()
  const citySlug = searchParams.get("city")
  const cityFromQuery = citySlug ? getPhase1CityBySlug(citySlug) : undefined
  const regionFilter =
    searchParams.get("region")?.trim() || cityFromQuery?.name || ""
  const wantRegister = searchParams.get("register") === "1"
  const wantAllMonitor = searchParams.get("view") === "all"

  const [rows, setRows] = useState<KnowledgeDocument[]>([])
  const [alerts, setAlerts] = useState<KnowledgeSyncAlert[]>([])
  const [drafts, setDrafts] = useState<PendingDraftForMonitor[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [pending, startTransition] = useTransition()
  const [showRegisterForm, setShowRegisterForm] = useState(wantRegister)
  const [showAllMonitor, setShowAllMonitor] = useState(wantAllMonitor)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [jurisdictionLevel, setJurisdictionLevel] =
    useState<JurisdictionLevel>(regionFilter ? "市区町村" : "都道府県")
  const [regionName, setRegionName] = useState(regionFilter)
  const [applicableYear, setApplicableYear] = useState(defaultFiscalYear)
  const [sourceUrl, setSourceUrl] = useState("")
  const [watchKind, setWatchKind] = useState<KnowledgeWatchKind>("file")
  const [cssSelector, setCssSelector] = useState("")
  const [notifyEmails, setNotifyEmails] = useState("")
  const [file, setFile] = useState<File | null>(null)

  const needsRegion = jurisdictionLevel !== "国"
  const isIndexWatch = watchKind === "index"

  const refreshList = useCallback(async () => {
    setLoadingList(true)
    setLoadError(null)
    try {
      const [docs, openAlerts, pendingDrafts] = await Promise.all([
        listKnowledgeDocumentsAction(),
        listOpenKnowledgeSyncAlertsAction(),
        listPendingChangeDraftsAction(),
      ])
      if (!docs.ok) {
        setLoadError(
          docs.error ??
            "一覧を取得できませんでした。マイグレーション適用をご確認ください。"
        )
        setRows([])
      } else {
        setRows(docs.data?.documents ?? [])
      }
      if (openAlerts.ok) {
        setAlerts(openAlerts.data?.alerts ?? [])
      }
      if (pendingDrafts.ok) {
        setDrafts(
          (pendingDrafts.data?.drafts ?? []).map((d) => ({
            id: d.id,
            created_at: d.created_at,
            ai_summary: d.ai_summary,
            knowledge_documents: d.knowledge_documents
              ? {
                  id: d.knowledge_documents.id,
                  title: d.knowledge_documents.title,
                }
              : null,
          }))
        )
      }
    } catch {
      setLoadError("一覧を取得できませんでした。")
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  useEffect(() => {
    if (!regionFilter) return
    setJurisdictionLevel("市区町村")
    setRegionName(regionFilter)
  }, [regionFilter])

  useEffect(() => {
    if (wantRegister) setShowRegisterForm(true)
  }, [wantRegister])

  useEffect(() => {
    if (wantAllMonitor) setShowAllMonitor(true)
  }, [wantAllMonitor])

  const monitorEvents = useMemo(
    () =>
      buildLinkageMonitorEvents({
        documents: rows,
        alerts,
        drafts,
      }),
    [rows, alerts, drafts]
  )

  const visibleMonitorEvents = showAllMonitor
    ? monitorEvents
    : monitorEvents.slice(0, MONITOR_PREVIEW_LIMIT)

  const selectedEvent: LinkageMonitorEvent | null =
    monitorEvents.find((e) => e.id === selectedEventId) ?? null

  function onSelectMonitorEvent(event: LinkageMonitorEvent) {
    if (event.result === "ok") return
    setSelectedEventId((prev) => (prev === event.id ? null : event.id))
  }

  const onDrop = useCallback((accepted: File[]) => {
    const next = accepted[0]
    if (!next) return
    if (
      next.type !== "application/pdf" &&
      !next.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.error("PDFファイルを選択してください。")
      return
    }
    if (next.size > 12 * 1024 * 1024) {
      toast.error("PDFは12MB以下にしてください。")
      return
    }
    setFile(next)
    setTitle((prev) => prev || next.name.replace(/\.pdf$/i, ""))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    maxSize: 12 * 1024 * 1024,
  })

  const sortedRows = useMemo(() => {
    const list = [...rows].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1
      }
      return b.applicable_year - a.applicable_year
    })
    if (!regionFilter) return list
    return list.filter(
      (d) =>
        d.region_name === regionFilter ||
        Boolean(d.region_name?.includes(regionFilter))
    )
  }, [rows, regionFilter])

  function resetForm() {
    setTitle("")
    setJurisdictionLevel(regionFilter ? "市区町村" : "都道府県")
    setRegionName(regionFilter)
    setApplicableYear(defaultFiscalYear())
    setSourceUrl("")
    setWatchKind("file")
    setCssSelector("")
    setNotifyEmails("")
    setFile(null)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (isIndexWatch) {
      if (!sourceUrl.trim()) {
        toast.error("一覧監視ではページURLを入力してください。")
        return
      }
      if (!cssSelector.trim()) {
        toast.error("一覧監視ではCSSセレクタを入力してください。")
        return
      }
    } else if (!file && !sourceUrl.trim()) {
      toast.error(
        "PDFファイルを選ぶか、監視用のPDF直リンク（source_url）を入力してください。"
      )
      return
    }
    if (!title.trim()) {
      toast.error("マニュアル名を入力してください。")
      return
    }
    if (needsRegion && !regionName.trim()) {
      toast.error(
        "都道府県・市区町村を選んだときは、地域名を入力してください（例：神奈川県）。"
      )
      return
    }

    startTransition(async () => {
      try {
        const fileBase64 =
          !isIndexWatch && file ? await fileToBase64(file) : undefined
        const result = await registerKnowledgeDocumentAction({
          title: title.trim(),
          jurisdictionLevel,
          regionName: needsRegion ? regionName.trim() : "",
          applicableYear,
          sourceUrl: sourceUrl.trim() || undefined,
          watchKind,
          cssSelector: isIndexWatch ? cssSelector.trim() : undefined,
          notifyEmails: notifyEmails.trim() || undefined,
          fileBase64,
          fileName: file?.name,
        })
        if (!result.ok || !result.data) {
          toast.error(result.error ?? "登録に失敗しました。")
          return
        }
        toast.success(
          "台帳に登録しました。監視URLがある場合は同期も試しています。"
        )
        resetForm()
        setShowRegisterForm(false)
        await refreshList()
      } catch {
        toast.error("登録に失敗しました。通信状況をご確認ください。")
      }
    })
  }

  function onArchive(doc: KnowledgeDocument) {
    if (doc.status === "archived") return
    if (
      !window.confirm(
        `「${doc.title}」をアーカイブ（無効化）しますか？自動収集の対象外になります。`
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await archiveKnowledgeDocumentAction(doc.id)
      if (!result.ok) {
        toast.error(result.error ?? "アーカイブに失敗しました。")
        return
      }
      toast.success("アーカイブしました。")
      await refreshList()
    })
  }

  function onResolveAlert(alertId: string) {
    startTransition(async () => {
      const result = await resolveKnowledgeSyncAlertAction(alertId)
      if (!result.ok) {
        toast.error(result.error ?? "対応済みにできませんでした。")
        return
      }
      toast.success("対応済みにしました。")
      await refreshList()
    })
  }

  function onSyncOne(documentId: string) {
    startTransition(async () => {
      const result = await runKnowledgeSyncNowAction(documentId)
      if (!result.ok) {
        toast.error(result.error ?? "同期に失敗しました。")
        return
      }
      const r = result.data?.results[0]
      toast.message(
        r?.message ??
          (r?.status === "unchanged"
            ? "変更はありませんでした。"
            : "同期が完了しました。")
      )
      await refreshList()
    })
  }

  function onSyncAll() {
    startTransition(async () => {
      const result = await runKnowledgeSyncNowAction()
      if (!result.ok) {
        toast.error(result.error ?? "一括同期に失敗しました。")
        return
      }
      toast.success(
        `同期しました（${result.data?.results.length ?? 0}件をチェック）。`
      )
      await refreshList()
    })
  }

  return (
    <div className={hidePageHeader ? "space-y-8" : "mx-auto max-w-5xl space-y-8"}>
      {hidePageHeader ? null : (
        <div>
          <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
            公開情報監視
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            公開情報と連携した行政マニュアルの監視結果を確認し、必要なら手動で台帳登録します。
          </p>
        </div>
      )}

      {cityFromQuery ? (
        <Alert className="rounded-xl border-primary/20 bg-primary/[0.03]">
          <FileText className="text-primary" />
          <AlertTitle>{cityFromQuery.name}向けに絞り込み中</AlertTitle>
          <AlertDescription className="text-base leading-relaxed">
            ルールブックから開いています。一覧はこの市の資料に絞り、新規登録の地域名も初期入力しています。{" "}
            <Link
              href={`/admin/rules/regulatory/${cityFromQuery.slug}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              ルールブックに戻る
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <section id="monitor-status" className="space-y-4" aria-labelledby="monitor-status-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="monitor-status-heading"
              className="text-lg font-bold text-primary-dark"
            >
              監視状況
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              監視した日時・対象PDF・結果（OK／NG／差分あり）です。NGと差分ありはタップで詳細を開けます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11"
              onClick={() => void refreshList()}
              disabled={loadingList || pending}
            >
              {loadingList ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              再読み込み
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-h-11"
              onClick={() => {
                setShowRegisterForm(true)
                requestAnimationFrame(() => {
                  document
                    .getElementById("manual-register")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                })
              }}
            >
              <Plus className="size-4" aria-hidden />
              手動登録
            </Button>
          </div>
        </div>

        <Card className="rounded-xl shadow-subtle">
          <CardContent className="space-y-3 p-4 sm:p-5">
            {loadingList && monitorEvents.length === 0 ? (
              <p className="py-6 text-center text-base text-muted-foreground">
                読み込み中…
              </p>
            ) : null}
            {!loadingList && monitorEvents.length === 0 ? (
              <p className="py-6 text-center text-base text-muted-foreground">
                まだ監視結果がありません。自治体ルール設定でPDF直リンクを登録すると、ここに出ます。
              </p>
            ) : null}
            <ul className="space-y-2" aria-label="監視状況の一覧">
              {visibleMonitorEvents.map((event) => {
                const clickable = event.result === "ng" || event.result === "diff"
                const selected = selectedEventId === event.id
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => onSelectMonitorEvent(event)}
                      className={cn(
                        "flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        clickable
                          ? "border-border bg-white hover:border-primary/30"
                          : "cursor-default border-border/60 bg-muted/20",
                        selected && "border-primary/40 bg-primary/[0.03]"
                      )}
                    >
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatMonitorDt(event.checkedAt)}
                      </span>
                      <span className="min-w-0 flex-1 font-medium text-primary-dark">
                        {event.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md tabular-nums",
                          monitorResultBadgeClass(event.result)
                        )}
                      >
                        {event.result === "ok" ? (
                          <Check className="mr-1 size-3.5" aria-hidden />
                        ) : event.result === "ng" ? (
                          <X className="mr-1 size-3.5" aria-hidden />
                        ) : null}
                        {linkageResultLabel(event.result)}
                      </Badge>
                    </button>
                  </li>
                )
              })}
            </ul>

            {monitorEvents.length > MONITOR_PREVIEW_LIMIT ? (
              <div className="pt-1">
                {showAllMonitor ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setShowAllMonitor(false)}
                  >
                    最新{MONITOR_PREVIEW_LIMIT}件だけ表示する
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setShowAllMonitor(true)}
                  >
                    全部見る（{monitorEvents.length}件）
                  </Button>
                )}
              </div>
            ) : null}

            {selectedEvent ? (
              <div
                id="monitor-detail"
                className="rounded-xl border border-primary/20 bg-primary/[0.02] px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      詳細
                    </p>
                    <p className="mt-1 text-base font-bold text-primary-dark">
                      {selectedEvent.title}
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                      {formatMonitorDt(selectedEvent.checkedAt)} ·{" "}
                      {linkageResultLabel(selectedEvent.result)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setSelectedEventId(null)}
                  >
                    閉じる
                  </Button>
                </div>
                <p className="mt-3 text-base leading-relaxed whitespace-pre-wrap text-foreground">
                  {selectedEvent.detail}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedEvent.result === "diff" ? (
                    <Button asChild size="lg" className="min-h-11">
                      <Link
                        href={
                          selectedEvent.draftId
                            ? `/admin/document-changes#draft-${selectedEvent.draftId}`
                            : "/admin/document-changes"
                        }
                      >
                        差分の詳細を確認する
                      </Link>
                    </Button>
                  ) : null}
                  {selectedEvent.result === "ng" && selectedEvent.alertId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="min-h-11"
                      disabled={pending}
                      onClick={() => onResolveAlert(selectedEvent.alertId!)}
                    >
                      対応済みにする
                    </Button>
                  ) : null}
                  {selectedEvent.documentId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="min-h-11"
                      disabled={pending}
                      onClick={() => onSyncOne(selectedEvent.documentId!)}
                    >
                      今すぐ再同期する
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap gap-2">
        {!showRegisterForm ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11"
            onClick={() => setShowRegisterForm(true)}
          >
            <Plus className="size-4" aria-hidden />
            手動登録する
          </Button>
        ) : null}
        <Button
          type="button"
          size="lg"
          className="min-h-11"
          onClick={onSyncAll}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          今すぐ一括同期
        </Button>
      </div>

      {showRegisterForm ? (
      <Card id="manual-register" className="rounded-lg shadow-subtle">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-lg">手動登録</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              監視方式を選び、PDF直リンクまたは新着一覧ページを登録します。日常は自治体ルール設定からの自動登録を優先してください。
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={() => setShowRegisterForm(false)}
          >
            閉じる
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="kd-watch-kind">監視方式</Label>
              <Select
                value={watchKind}
                onValueChange={(v) => {
                  const next = v as KnowledgeWatchKind
                  setWatchKind(next)
                  if (next === "index") setFile(null)
                }}
              >
                <SelectTrigger id="kd-watch-kind" className="h-11 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="file">
                    PDF直リンク（内容ハッシュ比較）
                  </SelectItem>
                  <SelectItem value="index">
                    新着一覧ページ（行単位の差分検知）
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                一覧監視は記事1件を指すCSSセレクタが必要です。抽出0件はセレクタ破損として要対応に出ます。
              </p>
            </div>

            {!isIndexWatch ? (
            <div
              {...getRootProps()}
              className={cn(
                "flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-background px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/40"
              )}
              aria-label="PDFをドロップ、またはタップして選択"
            >
              <input {...getInputProps()} />
              <div className="mb-3 flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Upload className="size-7" aria-hidden />
              </div>
              {file ? (
                <>
                  <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <FileText
                      className="size-5 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span className="break-all">{file.name}</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-foreground">
                    ここにPDFを置く／タップして選択（任意）
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    直リンクのみの登録も可能です（最大12MB）
                  </p>
                </>
              )}
            </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="kd-title">マニュアル名</Label>
                <Input
                  id="kd-title"
                  className="h-11 min-h-11 text-base"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：横浜市 運営指導マニュアル（訪問介護）"
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="kd-source">
                  {isIndexWatch
                    ? "監視用一覧ページURL（source_url）"
                    : "監視用PDF直リンク（source_url）"}
                </Label>
                <Input
                  id="kd-source"
                  type="url"
                  className="h-11 min-h-11 text-base"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder={
                    isIndexWatch
                      ? "https://example.go.jp/.../list.html"
                      : "https://example.go.jp/.../manual.pdf"
                  }
                  required={isIndexWatch}
                />
                <p className="text-sm text-muted-foreground">
                  {isIndexWatch
                    ? "新着が並ぶ一覧ページのURL。条件付きGETと行単位の差分検知の対象になります。"
                    : "公式サイトのPDFへの直URL。定期チェック（毎日）の対象になります。"}
                </p>
              </div>

              {isIndexWatch ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="kd-selector">
                    CSSセレクタ（記事1件＝1行）
                  </Label>
                  <Input
                    id="kd-selector"
                    className="h-11 min-h-11 text-base font-mono"
                    value={cssSelector}
                    onChange={(e) => setCssSelector(e.target.value)}
                    placeholder="例：ul.news-list li.item"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    ブラウザの検証ツールで、一覧の1件を囲む要素を指定してください。
                  </p>
                </div>
              ) : null}

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="kd-notify">
                  通知メールアドレス（任意・カンマ区切り）
                </Label>
                <Input
                  id="kd-notify"
                  type="text"
                  inputMode="email"
                  className="h-11 min-h-11 text-base"
                  value={notifyEmails}
                  onChange={(e) => setNotifyEmails(e.target.value)}
                  placeholder="例：ops@example.com, lead@example.com"
                />
                <p className="text-sm text-muted-foreground">
                  内容変更を検知したときの通知先です。未入力のときは運営用メール（OPERATOR_EMAILS）へ送ります。
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kd-jurisdiction">管轄レベル</Label>
                <Select
                  value={jurisdictionLevel}
                  onValueChange={(v) => {
                    const next = v as JurisdictionLevel
                    setJurisdictionLevel(next)
                    if (next === "国") setRegionName("")
                  }}
                >
                  <SelectTrigger id="kd-jurisdiction" className="h-11 min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JURISDICTION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}（{o.hint}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kd-region">
                  地域名
                  {needsRegion ? "（必須）" : "（国は不要）"}
                </Label>
                <Input
                  id="kd-region"
                  className="h-11 min-h-11 text-base"
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  placeholder={
                    jurisdictionLevel === "市区町村"
                      ? "例：横浜市"
                      : "例：神奈川県"
                  }
                  disabled={!needsRegion}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kd-year">適用年度</Label>
                <Input
                  id="kd-year"
                  type="number"
                  inputMode="numeric"
                  className="h-11 min-h-11 text-base tabular-nums"
                  value={applicableYear}
                  onChange={(e) => setApplicableYear(Number(e.target.value))}
                  min={2000}
                  max={2100}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  登録中…
                </>
              ) : (
                "登録する（Dify連携は段階導入）"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-primary-dark">登録済み台帳</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              公開情報監視の対象マニュアルです。同期結果と監視URLを確認できます。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11"
            onClick={() => void refreshList()}
            disabled={loadingList || pending}
          >
            {loadingList ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            再読み込み
          </Button>
        </div>

        {loadError ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertTitle>一覧を取得できませんでした</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-lg shadow-subtle">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[10rem]">マニュアル名</TableHead>
                  <TableHead>方式</TableHead>
                  <TableHead>管轄</TableHead>
                  <TableHead className="tabular-nums">年度</TableHead>
                  <TableHead>同期</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingList && sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      読み込み中…
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loadingList && sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      まだ登録がありません。
                    </TableCell>
                  </TableRow>
                ) : null}
                {sortedRows.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="max-w-[14rem]">
                      <p className="break-words font-medium">{doc.title}</p>
                      {doc.source_url ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {doc.source_url}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          監視URLなし
                        </p>
                      )}
                      {doc.watch_kind === "index" && doc.css_selector ? (
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {doc.css_selector}
                        </p>
                      ) : null}
                      {doc.last_error ? (
                        <p className="mt-1 text-xs leading-relaxed text-warning">
                          {doc.last_error}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {watchKindLabel(doc.watch_kind)}
                    </TableCell>
                    <TableCell>
                      {doc.jurisdiction_level}
                      {doc.region_name ? ` / ${doc.region_name}` : ""}
                    </TableCell>
                    <TableCell className="tabular-nums font-semibold">
                      {doc.applicable_year}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="rounded-lg border border-border"
                      >
                        {syncStatusLabel(doc.last_sync_status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {doc.status === "active" ? (
                        <Badge className="rounded-lg border-transparent bg-primary text-primary-foreground">
                          有効
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="rounded-lg border border-border"
                        >
                          アーカイブ
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="space-y-2 text-right">
                      {doc.source_url && doc.status === "active" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 w-full sm:w-auto"
                          disabled={pending}
                          onClick={() => onSyncOne(doc.id)}
                        >
                          今すぐ同期
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full sm:w-auto"
                        disabled={pending || doc.status === "archived"}
                        onClick={() => onArchive(doc)}
                      >
                        <Archive className="size-4" aria-hidden />
                        {doc.status === "archived"
                          ? "無効済み"
                          : "アーカイブ"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
