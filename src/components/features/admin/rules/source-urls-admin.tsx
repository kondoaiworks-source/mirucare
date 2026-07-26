"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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
  SOURCE_URL_DIRECT_FILE_HINT,
  SOURCE_URL_MONITORING_ALERT_BODY,
  SOURCE_URL_MONITORING_ALERT_TITLE,
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
  ExternalLink,
  Info,
  Loader2,
  Pencil,
  RefreshCw,
} from "lucide-react"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { PurposeGuide } from "@/components/features/admin/purpose-guide"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"

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

export function SourceUrlsAdmin() {
  const searchParams = useSearchParams()
  const citySlug = searchParams.get("city")
  const jurisdictionParam = searchParams.get("jurisdiction")
  const cityFromQuery = citySlug ? getPhase1CityBySlug(citySlug) : undefined

  const [rows, setRows] = useState<RuleSourceRow[]>([])
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
  const [queryFilterApplied, setQueryFilterApplied] = useState(false)

  const [editing, setEditing] = useState<EditState | null>(null)
  const [editOpenedFromQuery, setEditOpenedFromQuery] = useState(false)
  const editIdFromQuery = searchParams.get("edit")

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
    const result = await listMunicipalitySourceUrlsAction({
      jurisdictionId: filterJurisdiction === "all" ? undefined : filterJurisdiction,
      materialCategory: filterCategory,
      status: filterStatus,
      humanReviewStatus: filterReview,
    })
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      setRows([])
      setMunicipalities([])
    } else {
      setRows(result.data?.rows ?? [])
      setMunicipalities(
        (result.data?.municipalities ?? []).map((m) => ({
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

  useEffect(() => {
    if (queryFilterApplied || municipalities.length === 0) return
    if (jurisdictionParam) {
      setFilterJurisdiction(jurisdictionParam)
      setNewJurisdictionId(jurisdictionParam)
      setQueryFilterApplied(true)
      return
    }
    if (cityFromQuery) {
      const match = municipalities.find(
        (m) =>
          m.code === cityFromQuery.code || m.name === cityFromQuery.name
      )
      if (match) {
        setFilterJurisdiction(match.id)
        setNewJurisdictionId(match.id)
      }
      setQueryFilterApplied(true)
    }
  }, [
    municipalities,
    jurisdictionParam,
    cityFromQuery,
    queryFilterApplied,
  ])

  useEffect(() => {
    if (editOpenedFromQuery || !editIdFromQuery || loading) return

    const target = rows.find((r) => r.id === editIdFromQuery)
    if (!target) {
      // 市フィルタ等で隠れている場合は全件表示にして再取得する
      if (filterJurisdiction !== "all") {
        setFilterJurisdiction("all")
        return
      }
      setEditOpenedFromQuery(true)
      toast.message("指定の参照URLが見つかりませんでした。一覧から選んで修正してください。")
      return
    }

    setEditing(rowToEdit(target))
    setEditOpenedFromQuery(true)
    requestAnimationFrame(() => {
      document
        .getElementById(`source-url-edit-${target.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [
    editIdFromQuery,
    editOpenedFromQuery,
    filterJurisdiction,
    loading,
    rows,
  ])

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
      toast.success(result.data?.monitorMessage ?? "参照URLを登録しました。")
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
          <AdminBreadcrumb
            items={[
              {
                label: "ルールブック設定",
                href: "/admin/rules/regulatory",
              },
              { label: "参照サイト" },
            ]}
          />
          <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
            参照サイト（詳細・トラブル時）
          </h1>
          <p className="mt-1 max-w-3xl text-base leading-relaxed text-muted-foreground">
            日常の追加・修正・削除は各市ルールブックの「自治体ルール設定」で行います。ここは横断確認や細かい項目の調整用です。
          </p>
          {cityFromQuery ? (
            <p className="mt-2 text-base font-medium text-primary">
              {cityFromQuery.name}
              のルールブックから開いています（自治体フィルタ適用中）。
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

      <Alert className="rounded-xl border-primary/30 bg-primary/[0.04]">
        <Info className="text-primary" aria-hidden />
        <AlertTitle className="text-base text-primary-dark">
          日常の操作場所が変わりました
        </AlertTitle>
        <AlertDescription className="text-base leading-relaxed">
          国・県・市の参照URLの登録・修正・削除は、
          <Link
            href="/admin/rules/regulatory"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            ルールブック設定
          </Link>
          から市を開き、「自治体ルール設定」で行ってください。
        </AlertDescription>
      </Alert>

      <PurposeGuide
        purpose="横断一覧や細かい項目の調整用です。日常は市ルールブックの自治体ルール設定を使います。"
        steps={[
          "市ルールブックで追加・修正するのが基本",
          "ここは必要時のみ確認・調整",
          "保存後はルールブック側でも反映を確認",
        ]}
      />

      <h2 className="text-xl font-bold text-primary-dark">管理一覧</h2>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Alert className="rounded-xl border-accent/40 bg-accent/5">
        <AlertTriangle className="text-accent" aria-hidden />
        <AlertTitle className="text-base text-primary-dark">
          {SOURCE_URL_MONITORING_ALERT_TITLE}
        </AlertTitle>
        <AlertDescription className="text-base leading-relaxed text-foreground/90">
          <p>{SOURCE_URL_MONITORING_ALERT_BODY}</p>
          <p className="mt-2">
            台帳の詳細やトラブル対応は
            <Link
              href="/admin/rules/documents"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              監視トラブルの行政資料台帳
            </Link>
            から行えます。
          </p>
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
            <Label htmlFor="new-parent">親ページURL（一覧ページ可）</Label>
            <Input
              id="new-parent"
              type="url"
              className="h-11 min-h-11 text-base"
              value={newParentUrl}
              onChange={(e) => setNewParentUrl(e.target.value)}
              placeholder="https://"
            />
            <p className="text-sm leading-relaxed text-muted-foreground">
              根拠の所在を残すためのURLです。これだけでは自動監視が始まらないことがあります。
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-direct">
              直接ファイルURL（PDF直リンク・自動監視用）
            </Label>
            <Input
              id="new-direct"
              type="url"
              className="h-11 min-h-11 text-base"
              value={newDirectUrl}
              onChange={(e) => setNewDirectUrl(e.target.value)}
              placeholder="https://（PDF直リンク等）"
            />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {SOURCE_URL_DIRECT_FILE_HINT}
            </p>
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
          <Table className="min-w-[52rem] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[5.5rem]">自治体</TableHead>
                <TableHead className="w-[7.5rem]">資料カテゴリ</TableHead>
                <TableHead className="w-[11rem]">資料名</TableHead>
                <TableHead>URL</TableHead>
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
                  <TableCell colSpan={8} className="text-muted-foreground">
                    該当する参照URLがありません。seed を実行するか、上のフォームから登録してください。
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing ? (
        <Card
          id={`source-url-edit-${editing.id}`}
          className="rounded-xl border-primary/30 shadow-subtle"
        >
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
              <Label htmlFor="edit-parent">親ページURL（一覧ページ可）</Label>
              <Input
                id="edit-parent"
                type="url"
                className="h-11 min-h-11 text-base"
                value={editing.parentPageUrl}
                onChange={(e) =>
                  setEditing({ ...editing, parentPageUrl: e.target.value })
                }
              />
              <p className="text-sm leading-relaxed text-muted-foreground">
                根拠の所在を残すためのURLです。これだけでは自動監視が始まらないことがあります。
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-direct">
                直接ファイルURL（PDF直リンク・自動監視用）
              </Label>
              <Input
                id="edit-direct"
                type="url"
                className="h-11 min-h-11 text-base"
                value={editing.directFileUrl}
                onChange={(e) =>
                  setEditing({ ...editing, directFileUrl: e.target.value })
                }
              />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {SOURCE_URL_DIRECT_FILE_HINT}
              </p>
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
