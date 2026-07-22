"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { useDropzone } from "react-dropzone"
import Papa from "papaparse"
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Shield,
} from "lucide-react"
import { toast } from "sonner"
import { listServiceRecordsForMonthAction } from "@/app/actions/attendance-billing"
import {
  extractBillingRowsFromMatrix,
  reconcileBillingWithRecords,
  type BillingReconcileResult,
} from "@/lib/billing/reconcile"
import {
  detectImportKind,
  importKindLabel,
} from "@/lib/attendance/csv-parse"
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
import { ProductCharterBanner } from "@/components/features/product-charter-banner"
import { PRODUCT_CHARTER } from "@/lib/copy/product-charter"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/features/empty-state"
import { cn } from "@/lib/utils"

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function statusLabel(status: BillingReconcileResult["status"]): string {
  if (status === "exact") return "完全一致"
  if (status === "missing") return "日報なしの可能性"
  return "ずれの可能性"
}

export function BillingReconcileView() {
  const [yearMonth, setYearMonth] = useState(currentYearMonth)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [results, setResults] = useState<BillingReconcileResult[] | null>(null)
  // 別種CSV（請求ではない可能性）を検知したときのメッセージ
  const [csvIssue, setCsvIssue] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function resetFile() {
    setFileName(null)
    setResults(null)
    setParseWarnings([])
    setCsvIssue(null)
  }

  const counts = useMemo(() => {
    if (!results) return { exact: 0, bad: 0, total: 0 }
    const exact = results.filter((r) => r.status === "exact").length
    return {
      exact,
      bad: results.length - exact,
      total: results.length,
    }
  }, [results])

  const runReconcile = useCallback(
    (file: File) => {
      setFileName(file.name)
      setResults(null)
      setParseWarnings([])
      setCsvIssue(null)

      Papa.parse<string[]>(file, {
        header: false,
        skipEmptyLines: true,
        complete: (parsed) => {
          const matrix = (parsed.data ?? []).map((row) =>
            Array.isArray(row)
              ? row.map((cell) => String(cell ?? ""))
              : [String(row)]
          )

          const { rows, warnings } = extractBillingRowsFromMatrix(matrix)
          setParseWarnings(warnings)

          if (rows.length === 0) {
            // 勤怠・シフト・ヘルパー一覧など、請求以外のCSVの可能性を推定
            const detected = detectImportKind(matrix[0] ?? [])
            const looksAttendance =
              detected === "attendance" ||
              detected === "shifts" ||
              detected === "helpers"
            setCsvIssue(
              looksAttendance && detected
                ? `この画面は請求CSVの照合用ですが、「${importKindLabel(detected)}」の可能性があるファイルが選ばれています。正しい請求CSVをご確認ください。`
                : "請求CSVから照合できる行を読み取れませんでした。列名（利用者・日付・サービス提供時間）や、正しい請求CSVかをご確認ください。"
            )
            toast.error(
              "請求CSVを読み取れませんでした。ファイルをご確認ください。"
            )
            return
          }

          startTransition(async () => {
            const monthResult =
              await listServiceRecordsForMonthAction(yearMonth)
            if (!monthResult.ok) {
              toast.error(monthResult.error ?? "日報の取得に失敗しました")
              return
            }

            const reconciled = reconcileBillingWithRecords(
              rows,
              monthResult.data ?? []
            )
            setResults(reconciled)

            const bad = reconciled.filter((r) => r.status !== "exact").length
            if (bad === 0) {
              toast.success("すべて1分単位で一致しました")
            } else {
              toast.message(
                `${bad} 件にズレまたは日報不足の可能性があります。ご確認ください。`
              )
            }
          })
        },
        error: () => {
          toast.error(
            "CSVの読み込みに失敗しました。ファイル形式をご確認ください。"
          )
        },
      })
    },
    [yearMonth]
  )

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return
      // サーバー送信は行わない（ブラウザメモリ上のみ）
      runReconcile(file)
    },
    [runReconcile]
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
      "text/plain": [".csv"],
    },
    maxFiles: 1,
    multiple: false,
    noClick: true,
    noKeyboard: true,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">
          請求CSVの突合
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          国保連へ送る直前の請求CSVを、日報と1分単位で照合します。CSVはブラウザ内だけで処理し、サーバーには送りません。
        </p>
      </div>

      <ProductCharterBanner compact extra={PRODUCT_CHARTER.unverifiedScope} />

      <Alert className="rounded-lg border-primary/20 bg-primary/5">
        <Shield />
        <AlertTitle>個人情報は端末内で完結します</AlertTitle>
        <AlertDescription>
          請求CSVはアップロード・保存しません。照合に使う日報だけを事業所データから読み取ります。外部の表計算サービスへの書き出しも行いません。
        </AlertDescription>
      </Alert>

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">対象月とCSV</CardTitle>
          <CardDescription>
            毎月1回、送信前の確認にご利用ください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="billing-month">対象月</Label>
            <Input
              id="billing-month"
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="min-h-11 max-w-xs"
            />
          </div>

          <div
            {...getRootProps()}
            className={cn(
              "flex min-h-44 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border bg-background"
            )}
          >
            <input {...getInputProps()} aria-label="請求CSVファイル" />
            <FileSpreadsheet
              className="mb-3 size-10 text-primary"
              aria-hidden
            />
            <p className="text-base font-medium text-foreground">
              請求CSVをここにドロップ
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              または下のボタンから選択（.csv のみ）
            </p>
            <Button
              type="button"
              size="lg"
              className="mt-4 min-h-11"
              onClick={() => open()}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  照合中…
                </>
              ) : (
                "CSVを選んで照合する"
              )}
            </Button>
            {fileName ? (
              <p className="mt-3 text-sm text-muted-foreground">
                読み込み中のファイル名: {fileName}
                <span className="block text-xs">
                  （内容は端末メモリ上のみ。サーバー未送信）
                </span>
              </p>
            ) : null}
          </div>

          {csvIssue ? (
            <Alert className="rounded-lg border-warning/40 bg-warning/10">
              <AlertTriangle className="text-warning" />
              <AlertTitle>請求CSVをご確認ください</AlertTitle>
              <AlertDescription className="space-y-3">
                <p className="text-base leading-relaxed">{csvIssue}</p>
                {fileName ? (
                  <p className="text-sm">
                    <span className="font-medium text-foreground">
                      対象ファイル：
                    </span>
                    <span className="break-words [overflow-wrap:anywhere]">
                      {fileName}
                    </span>
                  </p>
                ) : null}
                <Button
                  type="button"
                  size="lg"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={resetFile}
                >
                  CSVを入れ直す
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {parseWarnings.length > 0 ? (
            <Alert variant="destructive" className="rounded-lg">
              <AlertTriangle />
              <AlertTitle>列の読み取りについて</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {parseWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {results && counts.total > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="tabular-nums">
            合計 {counts.total} 件
          </Badge>
          <Badge className="bg-emerald-100 text-emerald-800 tabular-nums">
            完全一致 {counts.exact} 件
          </Badge>
          <Badge className="bg-red-100 text-red-700 tabular-nums">
            要確認 {counts.bad} 件
          </Badge>
        </div>
      ) : null}

      {results === null ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="まだ照合結果はありません"
          description="対象月を選び、請求CSVをドロップすると、日報との1分単位の突合結果が表示されます。"
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="照合できる行がありませんでした"
          description="CSVの列名（利用者・日付・サービス提供時間）をご確認ください。"
        />
      ) : (
        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">照合結果</CardTitle>
            <CardDescription>
              完全一致は緑、ズレ・日報なしは赤で強調しています。日報が未取込の月は未検証です。ご確認ください。
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>行</TableHead>
                  <TableHead>利用者</TableHead>
                  <TableHead>日付</TableHead>
                  <TableHead>判定</TableHead>
                  <TableHead>請求時間</TableHead>
                  <TableHead>日報時間</TableHead>
                  <TableHead>警告</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row) => {
                  const ok = row.status === "exact"
                  return (
                    <TableRow
                      key={`${row.sourceRow}-${row.clientLabel}-${row.serviceDate}`}
                      className={cn(
                        ok
                          ? "bg-emerald-50 text-emerald-900 hover:bg-emerald-50/90"
                          : "bg-red-50 text-red-700 hover:bg-red-50/90"
                      )}
                    >
                      <TableCell className="tabular-nums">
                        {row.sourceRow}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.clientLabel}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.serviceDate}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          {ok ? (
                            <CheckCircle2
                              className="size-4 shrink-0"
                              aria-hidden
                            />
                          ) : (
                            <AlertTriangle
                              className="size-4 shrink-0"
                              aria-hidden
                            />
                          )}
                          {statusLabel(row.status)}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.billingStart}〜{row.billingEnd}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.recordStart && row.recordEnd
                          ? `${row.recordStart}〜${row.recordEnd}`
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal text-sm leading-relaxed">
                        {row.warning ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
