/**
 * Excel（.xlsx）→ シナリオ JSON 変換
 *
 * - test-data/input/*.xlsx を読み込み
 * - 5シートを既存シナリオ互換 JSON に変換
 * - test-data/scenarios/converted-from-excel-*.json に出力
 *
 * テンプレート生成:
 *   npx tsx scripts/convert-excel-to-json.ts --generate-template
 *
 * 変換:
 *   npm run convert:excel
 */

import fs from "node:fs"
import path from "node:path"
import ExcelJS from "exceljs"

const ROOT = path.resolve(__dirname, "..")
const TEMPLATE_DIR = path.join(ROOT, "test-data", "templates")
const INPUT_DIR = path.join(ROOT, "test-data", "input")
const OUTPUT_DIR = path.join(ROOT, "test-data", "scenarios")
const TEMPLATE_PATH = path.join(TEMPLATE_DIR, "mirucare-template.xlsx")

const SHEET_CARE_PLAN = "ケアプラン"
const SHEET_RECORD = "提供記録"
const SHEET_BILLING = "請求データ"
const SHEET_CONSENT = "同意書"
const SHEET_QUAL = "実施者資格"

const CARE_PLAN_HEADERS = [
  "利用者ID",
  "利用者名",
  "生年月日",
  "プランID",
  "作成日",
  "有効期間_開始",
  "有効期間_終了",
  "サービスNo",
  "サービス名",
  "頻度",
  "実施時間",
  "実施者資格",
] as const

const RECORD_HEADERS = [
  "利用者ID",
  "実施日",
  "サービス名",
  "実施時間_開始",
  "実施時間_終了",
  "実施分数",
  "実施者",
  "実施者資格",
  "実施内容",
] as const

const BILLING_HEADERS = [
  "利用者ID",
  "請求年月",
  "サービス名",
  "請求回数",
  "請求金額",
  "請求区分",
] as const

const CONSENT_HEADERS = [
  "利用者ID",
  "初回同意日",
  "初回署名",
  "ケアプラン変更日",
  "変更同意",
  "変更署名",
] as const

const QUAL_HEADERS = [
  "実施者名",
  "資格",
  "資格確認日",
  "資格証コピー確認",
] as const

type Row = Record<string, string>

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "あり" : "なし"
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, "0")
    const d = String(value.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim()
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue)
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text ?? "").join("").trim()
    }
  }
  return String(value).trim()
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true, name: "Noto Sans JP", size: 11 }
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE6F2F1" },
  }
  row.alignment = { vertical: "middle", wrapText: true }
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: readonly string[],
  rows: (string | number)[][]
): void {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  })
  sheet.addRow([...headers])
  styleHeaderRow(sheet.getRow(1))
  for (const row of rows) {
    sheet.addRow(row)
  }
  headers.forEach((_, i) => {
    const col = sheet.getColumn(i + 1)
    col.width = Math.min(28, Math.max(12, String(headers[i]).length + 4))
  })
}

/** 正常系サンプル（完全一致）をテンプレートに埋め込む */
async function generateTemplate(outPath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "監査のミカタ"
  workbook.created = new Date()

  addSheet(workbook, SHEET_CARE_PLAN, CARE_PLAN_HEADERS, [
    [
      "USR-001",
      "山田太郎",
      "1940-05-15",
      "PLAN-001",
      "2024-01-15",
      "2024-02-01",
      "2024-04-30",
      1,
      "身体介護（入浴）",
      "週2回（月・木）",
      "10:00-10:30（30分）",
      "介護職員初任者研修修了",
    ],
    [
      "USR-001",
      "山田太郎",
      "1940-05-15",
      "PLAN-001",
      "2024-01-15",
      "2024-02-01",
      "2024-04-30",
      2,
      "生活援助（調理・洗濯）",
      "週1回（水）",
      "14:00-14:45（45分）",
      "介護職員初任者研修修了",
    ],
  ])

  addSheet(workbook, SHEET_RECORD, RECORD_HEADERS, [
    [
      "USR-001",
      "2024-02-01",
      "身体介護（入浴）",
      "10:00",
      "10:30",
      30,
      "佐藤健太",
      "介護職員初任者研修修了",
      "入浴介助。本人は快適に入浴でき、本人より『気持ちよかった』との感想あり。皮膚状態は良好。",
    ],
    [
      "USR-001",
      "2024-02-04",
      "生活援助（調理・洗濯）",
      "14:00",
      "14:45",
      45,
      "鈴木由美",
      "介護職員初任者研修修了",
      "昼食の調理（和風スパゲッティ、みそ汁、サラダ）。洗濯物（下着類、靴下）を洗濯して干す。",
    ],
    [
      "USR-001",
      "2024-02-08",
      "身体介護（入浴）",
      "10:00",
      "10:30",
      30,
      "佐藤健太",
      "介護職員初任者研修修了",
      "入浴介助。本人は快適に入浴でき、特に変化なし。皮膚状態は良好。",
    ],
  ])

  addSheet(workbook, SHEET_BILLING, BILLING_HEADERS, [
    ["USR-001", "2024年2月", "身体介護（入浴）", 2, 4950, "介護給付"],
    ["USR-001", "2024年2月", "生活援助（調理・洗濯）", 1, 3000, "介護給付"],
  ])

  addSheet(workbook, SHEET_CONSENT, CONSENT_HEADERS, [
    ["USR-001", "2024-01-10", "あり", "", "", ""],
  ])

  addSheet(workbook, SHEET_QUAL, QUAL_HEADERS, [
    ["佐藤健太", "介護職員初任者研修修了", "2023-04-01", "あり"],
    ["鈴木由美", "介護職員初任者研修修了", "2023-06-15", "あり"],
  ])

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  await workbook.xlsx.writeFile(outPath)
  console.error(`[excel] wrote template ${outPath}`)
}

function readSheetAsRows(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  expectedHeaders: readonly string[]
): Row[] {
  const sheet = workbook.getWorksheet(sheetName)
  if (!sheet) {
    throw new Error(`シート「${sheetName}」が見つかりません`)
  }

  const headerRow = sheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = cellToString(cell.value)
  })

  for (const h of expectedHeaders) {
    if (!headers.includes(h)) {
      console.warn(
        `[excel] warn: シート「${sheetName}」に列「${h}」がありません（空として扱います）`
      )
    }
  }

  const rows: Row[] = []
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const obj: Row = {}
    let any = false
    headers.forEach((h, i) => {
      if (!h) return
      const v = cellToString(row.getCell(i + 1).value)
      obj[h] = v
      if (v) any = true
    })
    if (any) rows.push(obj)
  })
  return rows
}

function firstNonEmpty(rows: Row[], key: string): string {
  for (const r of rows) {
    const v = r[key]?.trim()
    if (v) return v
  }
  return ""
}

function toNumber(value: string): number | null {
  const n = Number(String(value).replace(/[,，円]/g, "").trim())
  return Number.isFinite(n) ? n : null
}

function convertWorkbookToScenario(
  workbook: ExcelJS.Workbook,
  sourceFileName: string
): Record<string, unknown> {
  const careRows = readSheetAsRows(workbook, SHEET_CARE_PLAN, CARE_PLAN_HEADERS)
  const recordRows = readSheetAsRows(workbook, SHEET_RECORD, RECORD_HEADERS)
  const billingRows = readSheetAsRows(workbook, SHEET_BILLING, BILLING_HEADERS)
  const consentRows = readSheetAsRows(workbook, SHEET_CONSENT, CONSENT_HEADERS)
  const qualRows = readSheetAsRows(workbook, SHEET_QUAL, QUAL_HEADERS)

  if (careRows.length === 0) {
    throw new Error("ケアプランシートにデータ行がありません")
  }

  const userId = firstNonEmpty(careRows, "利用者ID")
  const userName = firstNonEmpty(careRows, "利用者名")
  const birth = firstNonEmpty(careRows, "生年月日")
  const planId = firstNonEmpty(careRows, "プランID")
  const created = firstNonEmpty(careRows, "作成日")
  const validFrom = firstNonEmpty(careRows, "有効期間_開始")
  const validTo = firstNonEmpty(careRows, "有効期間_終了")

  const services = careRows
    .filter((r) => r["サービス名"]?.trim())
    .map((r, i) => ({
      サービスNo: toNumber(r["サービスNo"]) ?? i + 1,
      サービス名: r["サービス名"],
      頻度: r["頻度"] || undefined,
      実施時間: r["実施時間"] || undefined,
      実施者資格: r["実施者資格"] || undefined,
    }))

  const qualByName = new Map<string, Row>()
  for (const q of qualRows) {
    const name = q["実施者名"]?.trim()
    if (name) qualByName.set(name, q)
  }

  const 実績データ = recordRows.map((r, i) => {
    const start = r["実施時間_開始"]?.trim()
    const end = r["実施時間_終了"]?.trim()
    const timeRange =
      start && end ? `${start}-${end}` : start || end || ""
    const worker = r["実施者"]?.trim() ?? ""
    const qualRow = worker ? qualByName.get(worker) : undefined
    let 実施者資格 = r["実施者資格"]?.trim() || ""
    if (!実施者資格 && qualRow?.["資格"]) {
      実施者資格 = qualRow["資格"]
    }
    let 実施内容 = r["実施内容"]?.trim() || ""
    if (qualRow) {
      const confirm = qualRow["資格証コピー確認"]?.trim()
      const confirmDate = qualRow["資格確認日"]?.trim()
      const notes: string[] = []
      if (confirmDate) notes.push(`資格確認日:${confirmDate}`)
      if (confirm) notes.push(`資格証コピー確認:${confirm}`)
      if (notes.length > 0) {
        実施内容 = 実施内容
          ? `${実施内容}（${notes.join(" / ")}）`
          : notes.join(" / ")
      }
    }
    return {
      実施日: r["実施日"],
      サービスNo: i + 1,
      サービス名: r["サービス名"],
      実施時間: timeRange,
      実施分数: toNumber(r["実施分数"]) ?? undefined,
      実施者: worker || undefined,
      実施者資格: 実施者資格 || undefined,
      実施内容: 実施内容 || undefined,
      記録日: r["実施日"] || undefined,
    }
  })

  const billingMonth = firstNonEmpty(billingRows, "請求年月")
  const 請求内訳 = billingRows
    .filter((r) => r["サービス名"]?.trim())
    .map((r) => {
      const 請求回数 = toNumber(r["請求回数"])
      const 請求金額 = toNumber(r["請求金額"])
      const 単価 =
        請求回数 && 請求回数 > 0 && 請求金額 != null
          ? Math.round(請求金額 / 請求回数)
          : undefined
      return {
        サービス名: r["サービス名"],
        実施回数: 請求回数 ?? undefined,
        単価,
        小計: 請求金額 ?? undefined,
        請求区分: r["請求区分"] || undefined,
        根拠: "Excel請求データより",
      }
    })
  const 請求額_合計 = 請求内訳.reduce(
    (sum, item) => sum + (typeof item.小計 === "number" ? item.小計 : 0),
    0
  )

  const consent = consentRows.find((r) => !userId || r["利用者ID"] === userId) ??
    consentRows[0]
  const ケアプラン_変更: Record<string, string> | undefined = (() => {
    if (!consent) return undefined
    const changeDate = consent["ケアプラン変更日"]?.trim()
    if (!changeDate) return undefined
    return {
      変更日: changeDate,
      変更内容: "ケアプラン変更（Excel同意書シートより）",
      利用者同意: consent["変更同意"]?.trim() || "なし",
      同意書: consent["変更署名"]?.trim() || "なし",
    }
  })()

  const baseName = path.basename(sourceFileName, path.extname(sourceFileName))
  const scenario: Record<string, unknown> = {
    テストケースID: `excel_${baseName}`,
    テストケース名: `Excel変換: ${baseName}`,
    テスト目的:
      "Excel（.xlsx）から変換したケアプラン・提供記録・請求データを Dify Workflow で突合する",
    ソースファイル: sourceFileName,
    利用者情報: {
      利用者ID: userId,
      氏名: userName,
      生年月日: birth,
      ...(consent?.["初回同意日"]
        ? { 初回同意日: consent["初回同意日"], 初回署名: consent["初回署名"] || "" }
        : {}),
    },
    ケアプラン: {
      プランID: planId,
      作成日: created,
      有効期間_開始: validFrom,
      有効期間_終了: validTo,
      サービス内容: services,
    },
    ...(ケアプラン_変更 ? { ケアプラン_変更 } : {}),
    サービス実績記録: {
      記録ID: `REC-EXCEL-${userId || "unknown"}`,
      実績データ,
    },
    請求データ: {
      請求ID: `INV-EXCEL-${userId || "unknown"}`,
      請求年月: billingMonth,
      請求額_合計,
      請求内訳,
    },
    実施者資格一覧: qualRows.map((q) => ({
      実施者名: q["実施者名"],
      資格: q["資格"],
      資格確認日: q["資格確認日"],
      資格証コピー確認: q["資格証コピー確認"],
    })),
  }

  return scenario
}

function outputFileName(inputFileName: string): string {
  const base = path.basename(inputFileName, path.extname(inputFileName))
  const safe = base.replace(/[^\w\u3040-\u30ff\u4e00-\u9fff\-]+/g, "_")
  return `converted-from-excel-${safe}.json`
}

async function convertAll(): Promise<string[]> {
  fs.mkdirSync(INPUT_DIR, { recursive: true })
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"))

  if (files.length === 0) {
    console.error(
      `[excel] ${INPUT_DIR} に .xlsx がありません。テンプレートを input にコピーして再実行してください。`
    )
    console.error(`  cp ${TEMPLATE_PATH} ${path.join(INPUT_DIR, "sample.xlsx")}`)
    return []
  }

  const written: string[] = []
  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(inputPath)
    const scenario = convertWorkbookToScenario(workbook, file)
    const outName = outputFileName(file)
    const outPath = path.join(OUTPUT_DIR, outName)
    fs.writeFileSync(outPath, `${JSON.stringify(scenario, null, 2)}\n`, "utf8")
    console.error(`[excel] converted ${file} → ${outName}`)
    written.push(outPath)
  }
  return written
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const generateOnly = args.includes("--generate-template")
  const convertOnly = args.includes("--convert") || !generateOnly

  if (generateOnly || args.includes("--all")) {
    await generateTemplate(TEMPLATE_PATH)
  }

  if (generateOnly && !args.includes("--all") && !args.includes("--convert")) {
    return
  }

  if (convertOnly || args.includes("--all")) {
    // テンプレートが無い場合は先に生成
    if (!fs.existsSync(TEMPLATE_PATH)) {
      await generateTemplate(TEMPLATE_PATH)
    }
    // input が空ならサンプルを配置
    fs.mkdirSync(INPUT_DIR, { recursive: true })
    const inputFiles = fs
      .readdirSync(INPUT_DIR)
      .filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"))
    if (inputFiles.length === 0 && fs.existsSync(TEMPLATE_PATH)) {
      const sampleInput = path.join(INPUT_DIR, "sample.xlsx")
      fs.copyFileSync(TEMPLATE_PATH, sampleInput)
      console.error(`[excel] seeded ${sampleInput}`)
    }
    await convertAll()
  }
}

main().catch((err) => {
  console.error("[excel] failed", err instanceof Error ? err.message : err)
  process.exit(1)
})
