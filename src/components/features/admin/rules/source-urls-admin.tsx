"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  createMunicipalitySourceUrlAction,
  listMunicipalitySourceUrlsAction,
  updateRuleSourceUrlAction,
  type RuleSourceRow,
} from "@/app/actions/rule-engine"
import type {
  RuleHumanReviewStatus,
  RuleMaterialCategory,
  RuleSourceFileType,
  RuleSourceStatus,
  ServiceType,
} from "@/types/database"
import {
  FILE_TYPE_LABEL,
  HUMAN_REVIEW_STATUS_LABEL,
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABEL,
  SERVICE_TYPE_OPTIONS,
  TARGET_MUNICIPALITY_CODES,
  primarySourceUrl,
} from "@/lib/rule-engine/source-urls"
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
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
} from "lucide-react"

function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return iso.slice(0, 10)
}

function urlLinkLabel(url: string): string {
  try {
    const parsed = new URL(url)
    const path =
      parsed.pathname.length > 28
        ? `${parsed.pathname.slice(0, 26)}…`
        : parsed.pathname
    return `${parsed.hostname}${path}`
  } catch {
    return url.length > 42 ? `${url.slice(0, 41)}…` : url
  }
}

function SourceUrlLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className="group block min-w-0 text-sm text-primary"
    >
      <span className="line-clamp-2 break-all underline-offset-2 group-hover:underline">
        {urlLinkLabel(url)}
      </span>
      <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        原文を開く
      </span>
    </a>
  )
}

type EditState = {
  id: string
  title: string
  serviceType: ServiceType
  materialCategory: RuleMaterialCategory
  parentPageUrl: string
  directFileUrl: string
  priority: string
  sourceLastUpdatedOn: string
  fileType: RuleSourceFileType | ""
  contentHash: string
  status: RuleSourceStatus
  humanReviewStatus: RuleHumanReviewStatus
  memo: string
}

function rowToEdit(row: RuleSourceRow): EditState {
  return {
    id: row.id,
    title: row.title,
    serviceType: row.service_type,
    materialCategory: row.material_category ?? "訪問介護",
    parentPageUrl: row.parent_page_url ?? "",
    directFileUrl: row.direct_file_url ?? "",
    priority: String(row.priority),
    sourceLastUpdatedOn: row.source_last_updated_on ?? "",
    fileType: row.file_type ?? "",
    contentHash: row.content_hash ?? "",
    status: row.status,
    humanReviewStatus: row.human_review_status,
    memo: row.memo ?? "",
  }
}

type ReadinessSummary = {
  status: "ready" | "needs_attention"
  totalSlots: number
  coveredSlots: number
  missingSlots: Array<{ municipality: string; category: RuleMaterialCategory }>
  rowsNeedingAttention: Array<{ row: RuleSourceRow; reasons: string[] }>
  verifiedRows: number
  pdfDirectMissing: number
}

function readinessReasons(row: RuleSourceRow): string[] {
  const reasons: string[] = []
  if (row.status !== "active") reasons.push("無効")
  if (!primarySourceUrl(row)) reasons.push("URL未設定")
  if (row.human_review_status !== "verified") {
    reasons.push(`人間確認が${HUMAN_REVIEW_STATUS_LABEL[row.human_review_status]}`)
  }
  if (!row.last_verified_at) reasons.push("最終確認なし")
  if (row.file_type === "pdf" && !row.direct_file_url?.trim()) {
    reasons.push("PDF直リンク未設定")
  }
  if (!row.file_type) reasons.push("ファイル種別未設定")
  if (/(未確認|要確認|未設定)/.test(row.memo ?? "")) {
    reasons.push("メモに未確認事項あり")
  }
  return reasons
}

function buildReadinessSummary(
  rows: RuleSourceRow[],
  municipalities: Array<{ code: string; name: string }>
): ReadinessSummary {
  const targetMunicipalities = municipalities.filter((m) =>
    TARGET_MUNICIPALITY_CODES.includes(
      m.code as (typeof TARGET_MUNICIPALITY_CODES)[number]
    )
  )
  const activeRows = rows.filter((r) => r.status === "active")
  const covered = new Set<string>()

  for (const row of activeRows) {
    const code = row.rule_jurisdictions?.code
    if (
      code &&
      row.material_category &&
      primarySourceUrl(row) &&
      TARGET_MUNICIPALITY_CODES.includes(
        code as (typeof TARGET_MUNICIPALITY_CODES)[number]
      )
    ) {
      covered.add(`${code}:${row.material_category}`)
    }
  }

  const missingSlots: ReadinessSummary["missingSlots"] = []
  for (const municipality of targetMunicipalities) {
    for (const category of MATERIAL_CATEGORIES) {
      if (!covered.has(`${municipality.code}:${category}`)) {
        missingSlots.push({ municipality: municipality.name, category })
      }
    }
  }

  const rowsNeedingAttention = rows
    .map((row) => ({ row, reasons: readinessReasons(row) }))
    .filter((item) => item.reasons.length > 0)

  return {
    status:
      missingSlots.length === 0 && rowsNeedingAttention.length === 0
        ? "ready"
        : "needs_attention",
    totalSlots: targetMunicipalities.length * MATERIAL_CATEGORIES.length,
    coveredSlots:
      targetMunicipalities.length * MATERIAL_CATEGORIES.length -
      missingSlots.length,
    missingSlots,
    rowsNeedingAttention,
    verifiedRows: rows.filter((r) => r.human_review_status === "verified").length,
    pdfDirectMissing: rows.filter(
      (r) => r.file_type === "pdf" && !r.direct_file_url?.trim()
    ).length,
  }
}

export function SourceUrlsAdmin() {
  const [rows, setRows] = useState<RuleSourceRow[]>([])
  const [readinessRows, setReadinessRows] = useState<RuleSourceRow[]>([])
  const [municipalities, setMunicipalities] = useState<
    Array<{ id: string; name: string; code: string }>
  >([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  const [filterJurisdiction, setFilterJurisdiction] = useState("all")
  const [filterCategory, setFilterCategory] = useState<RuleMaterialCategory | "all">(
    "all"
  )
  const [filterStatus, setFilterStatus] = useState<RuleSourceStatus | "all">("all")
  const [filterReview, setFilterReview] = useState<RuleHumanReviewStatus | "all">(
    "all"
  )

  const [editing, setEditing] = useState<EditState | null>(null)

  const [newJurisdictionId, setNewJurisdictionId] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newServiceType, setNewServiceType] = useState<ServiceType>("訪問介護")
  const [newCategory, setNewCategory] =
    useState<RuleMaterialCategory>("訪問介護")
  const [newParentUrl, setNewParentUrl] = useState("")
  const [newDirectUrl, setNewDirectUrl] = useState("")
  const [newMemo, setNewMemo] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const filters = {
      jurisdictionId: filterJurisdiction === "all" ? undefined : filterJurisdiction,
      materialCategory: filterCategory,
      status: filterStatus,
      humanReviewStatus: filterReview,
    }
    const hasFilters =
      filters.jurisdictionId !== undefined ||
      filterCategory !== "all" ||
      filterStatus !== "all" ||
      filterReview !== "all"
    const [result, allResult] = await Promise.all([
      listMunicipalitySourceUrlsAction(filters),
      hasFilters ? listMunicipalitySourceUrlsAction() : Promise.resolve(null),
    ])
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      setRows([])
      setReadinessRows([])
      setMunicipalities([])
    } else {
      const readinessData = allResult?.ok ? allResult.data : result.data
      setRows(result.data?.rows ?? [])
      setReadinessRows(readinessData?.rows ?? [])
      setMunicipalities(
        (readinessData?.municipalities ?? result.data?.municipalities ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          code: m.code,
        }))
      )
    }
    setLoading(false)
  }, [filterJurisdiction, filterCategory, filterStatus, filterReview])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const stats = useMemo(() => {
    const missingUrl = rows.filter((r) => !primarySourceUrl(r)).length
    const needsReview = rows.filter(
      (r) =>
        r.human_review_status === "needs_review" ||
        r.human_review_status === "outdated" ||
        r.human_review_status === "unverified"
    ).length
    return { total: rows.length, missingUrl, needsReview }
  }, [rows])

  const readiness = useMemo(
    () => buildReadinessSummary(readinessRows, municipalities),
    [readinessRows, municipalities]
  )

  function saveEdit() {
    if (!editing) return
    startTransition(async () => {
      const result = await updateRuleSourceUrlAction({
        id: editing.id,
        title: editing.title,
        serviceType: editing.serviceType,
        materialCategory: editing.materialCategory,
        parentPageUrl: editing.parentPageUrl,
        directFileUrl: editing.directFileUrl,
        priority: Number(editing.priority),
        sourceLastUpdatedOn: editing.sourceLastUpdatedOn,
        fileType: editing.fileType,
        contentHash: editing.contentHash,
        status: editing.status,
        humanReviewStatus: editing.humanReviewStatus,
        memo: editing.memo,
      })
      if (!result.ok) {
        toast.error(result.error ?? "保存に失敗しました。")
        return
      }
      toast.success("参照URLを更新しました。")
      setEditing(null)
      await refresh()
    })
  }

  function markVerified(id: string) {
    startTransition(async () => {
      const result = await updateRuleSourceUrlAction({ id, markVerified: true })
      if (!result.ok) {
        toast.error(result.error ?? "確認記録に失敗しました。")
        return
      }
      toast.success("確認済みにしました。")
      await refresh()
    })
  }

  function onCreate() {
    startTransition(async () => {
      const result = await createMunicipalitySourceUrlAction({
        jurisdictionId: newJurisdictionId,
        title: newTitle,
        serviceType: newServiceType,
        materialCategory: newCategory,
        parentPageUrl: newParentUrl,
        directFileUrl: newDirectUrl,
        memo: newMemo,
      })
      if (!result.ok) {
        toast.error(result.error ?? "登録に失敗しました。")
        return
      }
      toast.success("参照URLを登録しました。")
      setNewTitle("")
      setNewParentUrl("")
      setNewDirectUrl("")
      setNewMemo("")
      await refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">参照URLマスタ</h1>
          <p className="mt-1 max-w-3xl text-base leading-relaxed text-muted-foreground">
            自治体・厚労省等の原文URLを正本として管理します。AI要約は正本にせず、
            差分抽出・チェック観点化のみに利用します。ルール反映は管理者承認後に行います。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11"
          onClick={() => void refresh()}
          disabled={loading || pending}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          一覧を更新する
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Alert className="rounded-xl border-primary/20 bg-muted/40">
        <AlertTitle className="text-base">行政マニュアル管理との違い</AlertTitle>
        <AlertDescription className="text-base leading-relaxed">
          この画面は「どの原文URLを根拠にするか」の台帳です。自動監視・差分検知・施設向けお知らせは
          <strong className="font-medium"> 行政マニュアル管理 </strong>
          （/admin/documents）で行います。URL台帳としての登録状態は下の「チェック準備状況」でご確認ください。重要PDFの変更検知を始める段階で、行政マニュアルに登録し、後から紐づけできます。
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-xl shadow-subtle">
          <CardHeader className="pb-2">
            <CardDescription>登録件数</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-xl shadow-subtle">
          <CardHeader className="pb-2">
            <CardDescription>URL未設定</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-accent">
              {stats.missingUrl}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-xl shadow-subtle">
          <CardHeader className="pb-2">
            <CardDescription>要確認</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-accent">
              {stats.needsReview}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card
        className={cn(
          "rounded-xl shadow-subtle",
          readiness.status === "ready"
            ? "border-primary/30"
            : "border-accent/40"
        )}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {readiness.status === "ready" ? (
              <CheckCircle2 className="size-5 text-primary" aria-hidden />
            ) : (
              <AlertTriangle className="size-5 text-accent" aria-hidden />
            )}
            チェック準備状況
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">
            URLを登録しただけでは準備完了とは扱いません。対象自治体ごとの必要カテゴリ、URL、人間確認、PDF直リンクを見て不足を表示します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <ReadinessMetric
              label="カテゴリ登録"
              value={`${readiness.coveredSlots}/${readiness.totalSlots}`}
              hint={`対象${TARGET_MUNICIPALITY_CODES.length}市 × ${MATERIAL_CATEGORIES.length}カテゴリ`}
            />
            <ReadinessMetric
              label="確認済み"
              value={`${readiness.verifiedRows}/${readinessRows.length}`}
              hint="人が原文URLを確認"
            />
            <ReadinessMetric
              label="要確認"
              value={`${readiness.rowsNeedingAttention.length}`}
              hint="不足理由がある登録"
              tone={readiness.rowsNeedingAttention.length > 0 ? "warning" : "ok"}
            />
            <ReadinessMetric
              label="PDF直リンク不足"
              value={`${readiness.pdfDirectMissing}`}
              hint="PDF扱いだが直リンクなし"
              tone={readiness.pdfDirectMissing > 0 ? "warning" : "ok"}
            />
          </div>

          {readiness.status === "ready" ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-base leading-relaxed text-primary-dark">
              準備OKです。対象自治体と資料カテゴリのURLがそろい、登録内容も確認済みです。
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              <ReadinessIssueList
                title="不足しているカテゴリ"
                empty="対象カテゴリの登録漏れはありません。"
                items={readiness.missingSlots
                  .slice(0, 8)
                  .map(
                    (slot) =>
                      `${slot.municipality}：${MATERIAL_CATEGORY_LABEL[slot.category]}`
                  )}
                moreCount={Math.max(readiness.missingSlots.length - 8, 0)}
              />
              <ReadinessIssueList
                title="登録内容の要確認"
                empty="登録内容の要確認はありません。"
                items={readiness.rowsNeedingAttention
                  .slice(0, 8)
                  .map(
                    ({ row, reasons }) =>
                      `${row.rule_jurisdictions?.name ?? "管轄不明"}／${row.title}：${reasons.join("、")}`
                  )}
                moreCount={Math.max(readiness.rowsNeedingAttention.length - 8, 0)}
              />
            </div>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">
            この判定は参照URLマスタの準備状況です。AIチェックへ反映するには、必要に応じて行政マニュアル管理での監視登録やルールエンジンでのチェック観点化もご確認ください。
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">絞り込み</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>自治体</Label>
            <Select value={filterJurisdiction} onValueChange={setFilterJurisdiction}>
              <SelectTrigger className="h-11 min-h-11">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {municipalities.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>資料カテゴリ</Label>
            <Select
              value={filterCategory}
              onValueChange={(v) =>
                setFilterCategory(v as RuleMaterialCategory | "all")
              }
            >
              <SelectTrigger className="h-11 min-h-11">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {MATERIAL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {MATERIAL_CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>有効/無効</Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as RuleSourceStatus | "all")}
            >
              <SelectTrigger className="h-11 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="active">有効</SelectItem>
                <SelectItem value="archived">無効</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>人間確認</Label>
            <Select
              value={filterReview}
              onValueChange={(v) =>
                setFilterReview(v as RuleHumanReviewStatus | "all")
              }
            >
              <SelectTrigger className="h-11 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {(
                  Object.keys(HUMAN_REVIEW_STATUS_LABEL) as RuleHumanReviewStatus[]
                ).map((k) => (
                  <SelectItem key={k} value={k}>
                    {HUMAN_REVIEW_STATUS_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">参照URLを登録する</CardTitle>
          <CardDescription className="text-base">
            初期データは seed で投入できます。追加はこちらから行えます。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>自治体</Label>
            <Select value={newJurisdictionId} onValueChange={setNewJurisdictionId}>
              <SelectTrigger className="h-11 min-h-11">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {municipalities.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-title">資料名</Label>
            <Input
              id="new-title"
              className="h-11 min-h-11 text-base"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例：訪問介護 実地指導マニュアル"
            />
          </div>
          <div className="space-y-2">
            <Label>サービス種別</Label>
            <Select
              value={newServiceType}
              onValueChange={(v) => setNewServiceType(v as ServiceType)}
            >
              <SelectTrigger className="h-11 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>資料カテゴリ</Label>
            <Select
              value={newCategory}
              onValueChange={(v) => setNewCategory(v as RuleMaterialCategory)}
            >
              <SelectTrigger className="h-11 min-h-11">
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
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-parent">親ページURL</Label>
            <Input
              id="new-parent"
              type="url"
              className="h-11 min-h-11 text-base"
              value={newParentUrl}
              onChange={(e) => setNewParentUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-direct">直接ファイルURL</Label>
            <Input
              id="new-direct"
              type="url"
              className="h-11 min-h-11 text-base"
              value={newDirectUrl}
              onChange={(e) => setNewDirectUrl(e.target.value)}
              placeholder="https://（PDF直リンク等）"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-memo">メモ</Label>
            <textarea
              id="new-memo"
              className="min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-base leading-relaxed"
              value={newMemo}
              onChange={(e) => setNewMemo(e.target.value)}
            />
          </div>
          <div>
            <Button
              type="button"
              size="lg"
              className="min-h-11"
              disabled={pending || !newJurisdictionId || !newTitle.trim()}
              onClick={onCreate}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              登録する
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">参照URL一覧</CardTitle>
          <CardDescription className="text-base">
            自治体別・資料カテゴリ別の根拠資料です。原文URLを正本として保管します。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[64rem] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[5.5rem]">自治体</TableHead>
                <TableHead className="w-[7.5rem]">資料カテゴリ</TableHead>
                <TableHead className="w-[11rem]">資料名</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-[9rem]">準備</TableHead>
                <TableHead className="w-[3.5rem] text-center">優先</TableHead>
                <TableHead className="w-[5.5rem]">確認</TableHead>
                <TableHead className="w-[4rem]">状態</TableHead>
                <TableHead className="w-[9rem] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const url = primarySourceUrl(row)
                const isEditing = editing?.id === row.id
                const reasons = readinessReasons(row)
                return (
                  <TableRow key={row.id} className="align-top">
                    <TableCell className="whitespace-normal break-words">
                      {row.rule_jurisdictions?.name ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm leading-snug">
                      {row.material_category
                        ? MATERIAL_CATEGORY_LABEL[row.material_category]
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-normal font-medium">
                      <span className="line-clamp-3">{row.title}</span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.service_type}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-normal">
                      {url ? (
                        <SourceUrlLink url={url} />
                      ) : (
                        <Badge variant="outline" className="rounded-lg text-accent">
                          URL未設定
                        </Badge>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        最終確認: {formatDateTime(row.last_verified_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        原文更新日: {formatDate(row.source_last_updated_on)}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {reasons.length === 0 ? (
                        <Badge className="gap-1 rounded-lg">
                          <CheckCircle2 className="size-3.5" aria-hidden />
                          準備OK
                        </Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className="gap-1 rounded-lg text-accent"
                          >
                            <AlertTriangle className="size-3.5" aria-hidden />
                            要確認
                          </Badge>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {reasons.slice(0, 2).join("、")}
                            {reasons.length > 2
                              ? ` ほか${reasons.length - 2}件`
                              : ""}
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal text-center tabular-nums">
                      {row.priority}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Badge
                        variant={
                          row.human_review_status === "verified"
                            ? "default"
                            : "outline"
                        }
                        className="rounded-lg"
                      >
                        {HUMAN_REVIEW_STATUS_LABEL[row.human_review_status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Badge
                        variant={row.status === "active" ? "default" : "outline"}
                        className="rounded-lg"
                      >
                        {row.status === "active" ? "有効" : "無効"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9"
                          onClick={() =>
                            setEditing(isEditing ? null : rowToEdit(row))
                          }
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          {isEditing ? "閉じる" : "編集"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-9"
                          disabled={pending}
                          onClick={() => markVerified(row.id)}
                        >
                          確認済み
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {!loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    該当する参照URLがありません。seed を実行するか、上のフォームから登録してください。
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing ? (
        <Card className="rounded-xl border-primary/30 shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">参照URLを編集する</CardTitle>
            <CardDescription>{editing.title}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-title">資料名</Label>
              <Input
                id="edit-title"
                className="h-11 min-h-11 text-base"
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>サービス種別</Label>
              <Select
                value={editing.serviceType}
                onValueChange={(v) =>
                  setEditing({ ...editing, serviceType: v as ServiceType })
                }
              >
                <SelectTrigger className="h-11 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>資料カテゴリ</Label>
              <Select
                value={editing.materialCategory}
                onValueChange={(v) =>
                  setEditing({
                    ...editing,
                    materialCategory: v as RuleMaterialCategory,
                  })
                }
              >
                <SelectTrigger className="h-11 min-h-11">
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
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-parent">親ページURL</Label>
              <Input
                id="edit-parent"
                type="url"
                className="h-11 min-h-11 text-base"
                value={editing.parentPageUrl}
                onChange={(e) =>
                  setEditing({ ...editing, parentPageUrl: e.target.value })
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-direct">直接ファイルURL</Label>
              <Input
                id="edit-direct"
                type="url"
                className="h-11 min-h-11 text-base"
                value={editing.directFileUrl}
                onChange={(e) =>
                  setEditing({ ...editing, directFileUrl: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-priority">優先度</Label>
              <Input
                id="edit-priority"
                type="number"
                min={1}
                max={999}
                className="h-11 min-h-11 text-base tabular-nums"
                value={editing.priority}
                onChange={(e) =>
                  setEditing({ ...editing, priority: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-updated">原文の最終更新日</Label>
              <Input
                id="edit-updated"
                type="date"
                className="h-11 min-h-11 text-base"
                value={editing.sourceLastUpdatedOn}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    sourceLastUpdatedOn: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>ファイル種別</Label>
              <Select
                value={editing.fileType || "none"}
                onValueChange={(v) =>
                  setEditing({
                    ...editing,
                    fileType: v === "none" ? "" : (v as RuleSourceFileType),
                  })
                }
              >
                <SelectTrigger className="h-11 min-h-11">
                  <SelectValue placeholder="未設定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未設定</SelectItem>
                  {(
                    Object.keys(FILE_TYPE_LABEL) as RuleSourceFileType[]
                  ).map((k) => (
                    <SelectItem key={k} value={k}>
                      {FILE_TYPE_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hash">ハッシュ値</Label>
              <Input
                id="edit-hash"
                className="h-11 min-h-11 font-mono text-sm"
                value={editing.contentHash}
                onChange={(e) =>
                  setEditing({ ...editing, contentHash: e.target.value })
                }
                placeholder="将来の変更検知用"
              />
            </div>
            <div className="space-y-2">
              <Label>有効/無効</Label>
              <Select
                value={editing.status}
                onValueChange={(v) =>
                  setEditing({ ...editing, status: v as RuleSourceStatus })
                }
              >
                <SelectTrigger className="h-11 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">有効</SelectItem>
                  <SelectItem value="archived">無効</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>人間確認ステータス</Label>
              <Select
                value={editing.humanReviewStatus}
                onValueChange={(v) =>
                  setEditing({
                    ...editing,
                    humanReviewStatus: v as RuleHumanReviewStatus,
                  })
                }
              >
                <SelectTrigger className="h-11 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(
                      HUMAN_REVIEW_STATUS_LABEL
                    ) as RuleHumanReviewStatus[]
                  ).map((k) => (
                    <SelectItem key={k} value={k}>
                      {HUMAN_REVIEW_STATUS_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-memo">メモ</Label>
              <textarea
                id="edit-memo"
                className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-base leading-relaxed"
                value={editing.memo}
                onChange={(e) =>
                  setEditing({ ...editing, memo: e.target.value })
                }
              />
            </div>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Button
                type="button"
                size="lg"
                className="min-h-11"
                disabled={pending}
                onClick={saveEdit}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                保存する
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11"
                onClick={() => setEditing(null)}
              >
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function ReadinessMetric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: string
  hint: string
  tone?: "default" | "ok" | "warning"
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "ok"
            ? "text-primary-dark"
            : tone === "warning"
              ? "text-accent"
              : "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {hint}
      </p>
    </div>
  )
}

function ReadinessIssueList({
  title,
  empty,
  items,
  moreCount,
}: {
  title: string
  empty: string
  items: string[]
  moreCount: number
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-primary-dark">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-accent"
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
          {moreCount > 0 ? (
            <li className="text-muted-foreground">ほか{moreCount}件あります。</li>
          ) : null}
        </ul>
      )}
    </div>
  )
}
