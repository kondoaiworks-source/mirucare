"use client"

import { useCallback, useEffect, useMemo, useState, useTransition, type FormEvent } from "react"
import { useDropzone } from "react-dropzone"
import {
  Archive,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
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
import type {
  JurisdictionLevel,
  KnowledgeDocument,
} from "@/types/database"

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
  // 日本の介護保険年度は4月始まり
  return month >= 4 ? year : year - 1
}

async function fetchKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  const res = await fetch("/api/admin/knowledge-documents", {
    method: "GET",
    cache: "no-store",
  })
  const json = (await res.json()) as {
    ok?: boolean
    data?: { documents?: KnowledgeDocument[] }
    error?: string
  }
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? "一覧を取得できませんでした。")
  }
  return json.data?.documents ?? []
}

async function registerKnowledgeDocument(input: {
  file: File
  title: string
  jurisdictionLevel: JurisdictionLevel
  regionName: string
  applicableYear: number
}): Promise<KnowledgeDocument> {
  const form = new FormData()
  form.append("file", input.file)
  form.append("title", input.title)
  form.append("jurisdictionLevel", input.jurisdictionLevel)
  form.append("regionName", input.regionName)
  form.append("applicableYear", String(input.applicableYear))

  // 本番: Dify Knowledge API へアップロード後、dify_document_id を保存
  console.log("[knowledge-documents] register → /api/admin/knowledge-documents", {
    title: input.title,
    jurisdictionLevel: input.jurisdictionLevel,
    regionName: input.regionName || null,
    applicableYear: input.applicableYear,
    fileName: input.file.name,
  })

  const res = await fetch("/api/admin/knowledge-documents", {
    method: "POST",
    body: form,
  })
  const json = (await res.json()) as {
    ok?: boolean
    data?: { document?: KnowledgeDocument }
    error?: string
  }
  if (!res.ok || !json.ok || !json.data?.document) {
    throw new Error(json.error ?? "Difyへの登録に失敗しました。")
  }
  return json.data.document
}

async function archiveKnowledgeDocument(id: string): Promise<void> {
  console.log("[knowledge-documents] archive", id)
  const res = await fetch(`/api/admin/knowledge-documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "archived" }),
  })
  const json = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? "アーカイブに失敗しました。")
  }
}

export function KnowledgeDocumentsAdmin() {
  const [rows, setRows] = useState<KnowledgeDocument[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [pending, startTransition] = useTransition()

  const [title, setTitle] = useState("")
  const [jurisdictionLevel, setJurisdictionLevel] =
    useState<JurisdictionLevel>("都道府県")
  const [regionName, setRegionName] = useState("")
  const [applicableYear, setApplicableYear] = useState(defaultFiscalYear)
  const [file, setFile] = useState<File | null>(null)

  const needsRegion = jurisdictionLevel !== "国"

  const refreshList = useCallback(async () => {
    setLoadingList(true)
    setLoadError(null)
    try {
      const documents = await fetchKnowledgeDocuments()
      setRows(documents)
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "一覧を取得できませんでした。"
      )
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  const onDrop = useCallback((accepted: File[]) => {
    const next = accepted[0]
    if (!next) return
    if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) {
      toast.error("PDFファイルを選択してください。")
      return
    }
    setFile(next)
    setTitle((prev) => prev || next.name.replace(/\.pdf$/i, ""))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    maxSize: 40 * 1024 * 1024,
  })

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "active" ? -1 : 1
        }
        return b.applicable_year - a.applicable_year
      }),
    [rows]
  )

  function resetForm() {
    setTitle("")
    setJurisdictionLevel("都道府県")
    setRegionName("")
    setApplicableYear(defaultFiscalYear())
    setFile(null)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      toast.error("PDFファイルを選択してください。")
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
    if (
      !Number.isInteger(applicableYear) ||
      applicableYear < 2000 ||
      applicableYear > 2100
    ) {
      toast.error("適用年度は2000〜2100の整数で入力してください。")
      return
    }

    startTransition(async () => {
      try {
        const document = await registerKnowledgeDocument({
          file,
          title: title.trim(),
          jurisdictionLevel,
          regionName: needsRegion ? regionName.trim() : "",
          applicableYear,
        })
        setRows((prev) => [document, ...prev])
        toast.success("Difyへ登録しました（モック）。台帳に追加しました。")
        resetForm()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "登録に失敗しました。通信状況をご確認ください。"
        )
      }
    })
  }

  function onArchive(doc: KnowledgeDocument) {
    if (doc.status === "archived") return
    if (
      !window.confirm(
        `「${doc.title}」をアーカイブ（無効化）しますか？チェックに使われなくなります。`
      )
    ) {
      return
    }
    startTransition(async () => {
      try {
        await archiveKnowledgeDocument(doc.id)
        setRows((prev) =>
          prev.map((row) =>
            row.id === doc.id
              ? {
                  ...row,
                  status: "archived",
                  updated_at: new Date().toISOString(),
                }
              : row
          )
        )
        toast.success("アーカイブしました。")
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "アーカイブに失敗しました。"
        )
      }
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          行政マニュアル管理
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          自治体のローカルルール（PDF）を登録し、Difyのナレッジとして紐づけます。本画面は運営オペレータ専用です。
        </p>
      </div>

      <Card className="rounded-lg shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">新規登録</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            PDFをアップし、管轄・地域・適用年度を入力して「Difyへ登録」してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
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
                    <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                    <span className="break-all">{file.name}</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB ·
                    別のPDFに差し替える場合はここにドロップ
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-foreground">
                    ここにPDFを置く／タップして選択
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    行政マニュアル・実地指導資料など（PDF／最大40MB）
                  </p>
                </>
              )}
            </div>

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
                  {needsRegion ? (
                    <span className="font-normal text-muted-foreground">
                      （必須）
                    </span>
                  ) : (
                    <span className="font-normal text-muted-foreground">
                      （国は不要）
                    </span>
                  )}
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
                <p className="text-sm text-muted-foreground">
                  介護保険の年度（4月始まり）を整数で入力します。
                </p>
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
                "Difyへ登録"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-primary-dark">登録済み台帳</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Supabaseの knowledge_documents を表示する想定です（現在はモックAPI）。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
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
                  <TableHead className="min-w-[12rem]">マニュアル名</TableHead>
                  <TableHead>管轄</TableHead>
                  <TableHead>地域</TableHead>
                  <TableHead className="tabular-nums">年度</TableHead>
                  <TableHead>Dify ID</TableHead>
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
                      まだ登録がありません。上のフォームからPDFを登録してください。
                    </TableCell>
                  </TableRow>
                ) : null}
                {sortedRows.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="max-w-[16rem] break-words font-medium">
                      {doc.title}
                    </TableCell>
                    <TableCell>{doc.jurisdiction_level}</TableCell>
                    <TableCell>{doc.region_name ?? "—"}</TableCell>
                    <TableCell className="tabular-nums font-semibold">
                      {doc.applicable_year}
                    </TableCell>
                    <TableCell className="max-w-[10rem] truncate font-mono text-xs text-muted-foreground">
                      {doc.dify_document_id ?? "—"}
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
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={pending || doc.status === "archived"}
                        onClick={() => onArchive(doc)}
                      >
                        <Archive className="size-4" aria-hidden />
                        {doc.status === "archived"
                          ? "無効済み"
                          : "アーカイブ（無効化）"}
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
