"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useDropzone } from "react-dropzone"
import Papa from "papaparse"
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { commitAttendanceImportAction } from "@/app/actions/attendance-import"
import {
  CARE_SOFT_PRESETS,
  detectImportKind,
  importKindLabel,
  parseAttendanceImportMatrix,
  type AttendanceImportKind,
  type CareSoftPresetId,
  type ParsedAttendanceImport,
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

const KIND_OPTIONS: { value: AttendanceImportKind | "auto"; label: string }[] =
  [
    { value: "auto", label: "自動判定" },
    { value: "helpers", label: "ヘルパー一覧" },
    { value: "attendance", label: "タイムカード（勤怠）" },
    { value: "service_records", label: "サービス提供記録（日報）" },
    { value: "shifts", label: "シフト" },
  ]

function matrixFromPapa(data: unknown[]): string[][] {
  return data.map((row) =>
    Array.isArray(row)
      ? row.map((cell) => String(cell ?? ""))
      : [String(row ?? "")]
  )
}

function previewRows(parsed: ParsedAttendanceImport): {
  headers: string[]
  cells: string[][]
} {
  if (parsed.kind === "helpers") {
    return {
      headers: ["行", "ヘルパー名", "職員コード"],
      cells: parsed.rows.slice(0, 20).map((r) => [
        String(r.sourceRow),
        r.displayName,
        r.employeeCode ?? "—",
      ]),
    }
  }
  if (parsed.kind === "attendance") {
    return {
      headers: ["行", "ヘルパー", "日付", "出勤", "退勤"],
      cells: parsed.rows.slice(0, 20).map((r) => [
        String(r.sourceRow),
        r.helperName,
        r.workDate,
        r.clockInHm,
        r.clockOutHm,
      ]),
    }
  }
  if (parsed.kind === "service_records") {
    return {
      headers: ["行", "ヘルパー", "利用者", "日付", "開始", "終了"],
      cells: parsed.rows.slice(0, 20).map((r) => [
        String(r.sourceRow),
        r.helperName,
        r.clientLabel,
        r.serviceDate,
        r.startHm,
        r.endHm,
      ]),
    }
  }
  return {
    headers: ["行", "ヘルパー", "日付", "開始", "終了", "備考"],
    cells: parsed.rows.slice(0, 20).map((r) => [
      String(r.sourceRow),
      r.helperName,
      r.workDate,
      r.startHm,
      r.endHm,
      r.note ?? "—",
    ]),
  }
}

type AttendanceImportViewProps = {
  /** 月次の用途別入口から渡す。指定時はデータ種類を固定し、別種CSVは入れ直しを促す。 */
  lockedKind?: AttendanceImportKind
}

const LOCKED_KIND_COPY: Record<
  "service_records" | "attendance",
  { title: string; description: string }
> = {
  service_records: {
    title: "日報CSVを取り込む",
    description:
      "サービス提供記録（日報）のCSVを取り込みます。請求CSVと照合する基準データになります。",
  },
  attendance: {
    title: "勤怠・タイムカードCSVを取り込む",
    description:
      "出勤・退勤のタイムカードCSVを取り込みます。日報との時間ズレ確認に使います。",
  },
}

export function AttendanceImportView({
  lockedKind,
}: AttendanceImportViewProps = {}) {
  const [preset, setPreset] = useState<CareSoftPresetId>("generic")
  const [kindChoice, setKindChoice] = useState<AttendanceImportKind | "auto">(
    lockedKind ?? "auto"
  )
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedAttendanceImport | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [detectedKind, setDetectedKind] = useState<AttendanceImportKind | null>(
    null
  )
  const [pending, startTransition] = useTransition()

  const kindMismatch =
    lockedKind != null &&
    detectedKind != null &&
    detectedKind !== lockedKind

  function resetFile() {
    setFileName(null)
    setParsed(null)
    setParseError(null)
    setDetectedKind(null)
  }

  const preview = useMemo(
    () => (parsed ? previewRows(parsed) : null),
    [parsed]
  )

  const runParse = useCallback(
    (file: File) => {
      setFileName(file.name)
      setParsed(null)
      setParseError(null)
      setDetectedKind(null)

      Papa.parse<string[]>(file, {
        header: false,
        skipEmptyLines: true,
        complete: (result) => {
          const matrix = matrixFromPapa(result.data ?? [])
          const headers = matrix[0] ?? []
          const forcedKind =
            kindChoice === "auto" ? null : kindChoice
          // ファイル名・列名からの推定種類（別種CSV確認に使う）
          const detected = detectImportKind(headers, preset)
          setDetectedKind(detected)

          const outcome = parseAttendanceImportMatrix(matrix, {
            kind: forcedKind,
            preset,
          })

          if ("error" in outcome) {
            setParseError(outcome.error)
            toast.error(outcome.error)
            return
          }

          setParsed(outcome)
          toast.message(
            `${importKindLabel(outcome.kind)}として ${outcome.rows.length} 行を読み取りました${
              detected && kindChoice === "auto"
                ? "（自動判定）"
                : ""
            }`
          )
        },
        error: () => {
          setParseError("CSVの読み込みに失敗しました。文字コードをご確認ください。")
          toast.error("CSVの読み込みに失敗しました")
        },
      })
    },
    [kindChoice, preset]
  )

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return
      runParse(file)
    },
    [runParse]
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

  function commitImport() {
    if (!parsed || parsed.rows.length === 0) return

    startTransition(async () => {
      const payload =
        parsed.kind === "helpers"
          ? ({ kind: "helpers" as const, rows: parsed.rows })
          : parsed.kind === "attendance"
            ? ({ kind: "attendance" as const, rows: parsed.rows })
            : parsed.kind === "service_records"
              ? ({ kind: "service_records" as const, rows: parsed.rows })
              : ({ kind: "shifts" as const, rows: parsed.rows })

      const result = await commitAttendanceImportAction(payload)

      if (!result.ok || !result.data) {
        toast.error(result.error ?? "取り込みに失敗しました")
        return
      }

      const d = result.data
      toast.success(
        `取り込み完了：新規 ${d.inserted} / 更新 ${d.updated} / スキップ ${d.skipped}`
      )
      if (d.unresolvedHelpers > 0) {
        toast.message(
          `ヘルパーを特定できなかった行が ${d.unresolvedHelpers} 件あります。職員コード付きのヘルパー一覧を先に取り込むと精度が上がります。`
        )
      }
    })
  }

  const heading = lockedKind
    ? LOCKED_KIND_COPY[lockedKind as "service_records" | "attendance"]
    : {
        title: "勤怠・日報データを取り込む",
        description:
          "介護ソフトから書き出したCSVを取り込みます。連携方式は「CSV書き出し → 本画面で取込」です（API直結は今後対応予定）。",
      }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">
          {heading.title}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {heading.description}
        </p>
      </div>

      <Alert className="rounded-lg">
        <Upload />
        <AlertTitle>取り込みの流れ</AlertTitle>
        <AlertDescription className="space-y-1 text-base leading-relaxed">
          <p>1. 介護ソフトで勤怠・日報・シフトなどをCSV出力する</p>
          <p>2. ソフトの種類を選び、CSVをドロップしてプレビューする</p>
          <p>3. 問題なければ「事業所データに取り込む」で確定する</p>
          <p className="text-sm text-muted-foreground">
            生のCSVファイルは保存しません。確定時に必要な項目だけを事業所DBへ登録します。被保険者番号は保存しません。
          </p>
        </AlertDescription>
      </Alert>

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">介護ソフト連携（CSV）</CardTitle>
          <CardDescription>
            列名のゆれに合わせてソフト種別を選ぶと、読み取り精度が上がります。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="care-soft">介護ソフトの種類</Label>
              <Select
                value={preset}
                onValueChange={(v) => setPreset(v as CareSoftPresetId)}
              >
                <SelectTrigger id="care-soft" className="min-h-11">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {CARE_SOFT_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {CARE_SOFT_PRESETS.find((p) => p.id === preset)?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-kind">データの種類</Label>
              {lockedKind ? (
                <div className="flex min-h-11 items-center rounded-lg border border-border bg-surface px-3 text-base font-medium text-foreground">
                  {importKindLabel(lockedKind)}
                </div>
              ) : (
                <Select
                  value={kindChoice}
                  onValueChange={(v) =>
                    setKindChoice(v as AttendanceImportKind | "auto")
                  }
                >
                  <SelectTrigger id="import-kind" className="min-h-11">
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {lockedKind ? (
                <p className="text-sm text-muted-foreground">
                  この画面は「{importKindLabel(lockedKind)}」専用です。別の種類のCSVは、月次確認のトップから正しい入口をお選びください。
                </p>
              ) : null}
            </div>
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
            <input {...getInputProps()} aria-label="勤怠・日報CSVファイル" />
            <FileSpreadsheet
              className="mb-3 size-10 text-primary"
              aria-hidden
            />
            <p className="text-base font-medium">介護ソフトのCSVをドロップ</p>
            <p className="mt-1 text-sm text-muted-foreground">
              .csv のみ（UTF-8 / Shift_JIS はソフト側でUTF-8推奨）
            </p>
            <Button
              type="button"
              size="lg"
              className="mt-4 min-h-11"
              onClick={() => open()}
            >
              CSVを選んで読み取る
            </Button>
            {fileName ? (
              <p className="mt-3 text-sm text-muted-foreground">
                選択中: {fileName}
              </p>
            ) : null}
          </div>

          {parseError ? (
            <Alert variant="destructive" className="rounded-lg">
              <AlertTriangle />
              <AlertTitle>読み取りできませんでした</AlertTitle>
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          ) : null}

          {kindMismatch ? (
            <Alert className="rounded-lg border-warning/40 bg-warning/10">
              <AlertTriangle className="text-warning" />
              <AlertTitle>別の種類のCSVの可能性があります</AlertTitle>
              <AlertDescription className="space-y-3">
                <p className="text-base leading-relaxed">
                  この画面は「{importKindLabel(lockedKind!)}」の取込画面ですが、
                  {detectedKind
                    ? `「${importKindLabel(detectedKind)}」`
                    : "別の種類"}
                  の可能性があるファイルが選ばれています。正しいCSVかご確認ください。
                </p>
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
        </CardContent>
      </Card>

      {parsed ? (
        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">プレビュー</CardTitle>
              <Badge variant="secondary">{importKindLabel(parsed.kind)}</Badge>
              <Badge className="tabular-nums" variant="outline">
                {parsed.rows.length} 行
              </Badge>
              {parsed.issues.length > 0 ? (
                <Badge className="bg-warning/15 text-warning tabular-nums">
                  読み飛ばし {parsed.issues.length} 行
                </Badge>
              ) : null}
            </div>
            <CardDescription>
              先頭20行を表示しています。問題なければ取り込みを確定してください。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.issues.length > 0 ? (
              <Alert className="rounded-lg">
                <AlertTriangle />
                <AlertTitle>一部の行を読み飛ばしています</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 max-h-32 list-disc space-y-1 overflow-y-auto pl-4 text-sm">
                    {parsed.issues.slice(0, 10).map((issue) => (
                      <li key={`${issue.sourceRow}-${issue.message}`}>
                        {issue.sourceRow}行目: {issue.message}
                      </li>
                    ))}
                    {parsed.issues.length > 10 ? (
                      <li>ほか {parsed.issues.length - 10} 件</li>
                    ) : null}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            {preview && parsed.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.headers.map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.cells.map((row, idx) => (
                      <TableRow key={`${row[0]}-${idx}`}>
                        {row.map((cell, cIdx) => (
                          <TableCell
                            key={`${idx}-${cIdx}`}
                            className={
                              cIdx === 0 || /\d{4}-\d{2}/.test(cell)
                                ? "tabular-nums"
                                : undefined
                            }
                          >
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-base text-muted-foreground">
                取り込める有効行がありませんでした。
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              {kindMismatch ? (
                <>
                  <Button
                    size="lg"
                    className="min-h-11"
                    onClick={resetFile}
                  >
                    CSVを入れ直す
                  </Button>
                  {/* 例外的な導線。目立たせすぎない。 */}
                  <Button
                    size="lg"
                    variant="ghost"
                    className="min-h-11 text-muted-foreground"
                    disabled={pending || parsed.rows.length === 0}
                    onClick={commitImport}
                  >
                    {pending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        取り込み中…
                      </>
                    ) : (
                      "内容を確認してこのまま取り込む"
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="min-h-11"
                    disabled={pending || parsed.rows.length === 0}
                    onClick={commitImport}
                  >
                    {pending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        取り込み中…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4" aria-hidden />
                        事業所データに取り込む
                      </>
                    )}
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="min-h-11"
                  >
                    <Link href="/attendance">矛盾検知へ進む</Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-lg border-dashed shadow-none">
        <CardHeader>
          <CardTitle className="text-base">推奨する列名の例</CardTitle>
          <CardDescription className="space-y-2 text-sm leading-relaxed">
            <p>
              <span className="font-medium text-foreground">タイムカード:</span>{" "}
              ヘルパー名 / 職員コード / 日付 / 出勤 / 退勤
            </p>
            <p>
              <span className="font-medium text-foreground">日報:</span>{" "}
              ヘルパー名 / 職員コード / 利用者 / 日付 / 開始 / 終了（または提供時間）
            </p>
            <p>
              <span className="font-medium text-foreground">ヘルパー一覧:</span>{" "}
              ヘルパー名 / 職員コード（先に取り込むと突合精度が上がります）
            </p>
            <p className="pt-1">
              サンプルCSV:{" "}
              <a
                className="text-primary underline underline-offset-2"
                href="/samples/attendance-helpers.csv"
                download
              >
                ヘルパー
              </a>
              {" · "}
              <a
                className="text-primary underline underline-offset-2"
                href="/samples/attendance-timecard.csv"
                download
              >
                タイムカード
              </a>
              {" · "}
              <a
                className="text-primary underline underline-offset-2"
                href="/samples/attendance-service-records.csv"
                download
              >
                日報
              </a>
            </p>
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
