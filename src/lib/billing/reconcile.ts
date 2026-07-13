/**
 * 請求CSV（国保連向け）と日報の1分単位突合 — ブラウザ完結用の純関数
 * CSV本体はサーバーへ送信しない
 */

export type BillingCsvRow = {
  clientLabel: string
  serviceDate: string
  startHm: string
  endHm: string
  /** 元CSVの行番号（1始まり・ヘッダー除く） */
  sourceRow: number
}

export type ServiceRecordForReconcile = {
  id: string
  client_label: string
  service_date: string
  start_at: string
  end_at: string
}

export type ReconcileMatchStatus = "exact" | "mismatch" | "missing"

export type BillingReconcileResult = {
  clientLabel: string
  serviceDate: string
  billingStart: string
  billingEnd: string
  recordStart: string | null
  recordEnd: string | null
  status: ReconcileMatchStatus
  warning: string | null
  sourceRow: number
}

const CLIENT_ALIASES = [
  "利用者",
  "利用者名",
  "氏名",
  "お客様",
  "顧客名",
  "client",
  "name",
] as const

const DATE_ALIASES = [
  "日付",
  "サービス提供日",
  "提供日",
  "実施日",
  "年月日",
  "date",
  "service_date",
] as const

const START_ALIASES = [
  "開始",
  "開始時間",
  "開始時刻",
  "サービス開始",
  "提供開始",
  "start",
  "start_time",
] as const

const END_ALIASES = [
  "終了",
  "終了時間",
  "終了時刻",
  "サービス終了",
  "提供終了",
  "end",
  "end_time",
] as const

const TIME_RANGE_ALIASES = [
  "サービス提供時間",
  "提供時間",
  "時間",
  "サービス時間",
] as const

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "")
}

function findColumnIndex(
  headers: string[],
  aliases: readonly string[]
): number {
  const normalized = headers.map(normalizeHeader)
  for (const alias of aliases) {
    const target = normalizeHeader(alias)
    const idx = normalized.findIndex((h) => h === target || h.includes(target))
    if (idx >= 0) return idx
  }
  return -1
}

/** YYYY-MM-DD に正規化。失敗時は空文字 */
export function normalizeDate(raw: string): string {
  const s = raw.trim()
  if (!s) return ""

  const iso = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/)
  if (iso) {
    const y = iso[1]
    const m = iso[2].padStart(2, "0")
    const d = iso[3].padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  const jp = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (jp) {
    return `${jp[1]}-${jp[2].padStart(2, "0")}-${jp[3].padStart(2, "0")}`
  }

  return ""
}

/** HH:mm（分単位）に正規化 */
export function normalizeHm(raw: string): string {
  const s = raw.trim()
  if (!s) return ""

  const withSec = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (withSec) {
    return `${withSec[1].padStart(2, "0")}:${withSec[2]}`
  }

  const compact = s.match(/^(\d{1,2})(\d{2})$/)
  if (compact) {
    return `${compact[1].padStart(2, "0")}:${compact[2]}`
  }

  const jp = s.match(/^(\d{1,2})時(\d{1,2})分?/)
  if (jp) {
    return `${jp[1].padStart(2, "0")}:${jp[2].padStart(2, "0")}`
  }

  return ""
}

function parseTimeRange(raw: string): { start: string; end: string } | null {
  const s = raw.trim()
  const m = s.match(
    /(\d{1,2}:\d{2}(?::\d{2})?)\s*[〜~\-－–—]\s*(\d{1,2}:\d{2}(?::\d{2})?)/
  )
  if (!m) return null
  const start = normalizeHm(m[1])
  const end = normalizeHm(m[2])
  if (!start || !end) return null
  return { start, end }
}

function isoToHm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function normalizeClientKey(label: string): string {
  return label.trim().replace(/\s+/g, "").replace(/　/g, "")
}

export type ParsedBillingCsv = {
  rows: BillingCsvRow[]
  warnings: string[]
}

/**
 * PapaParse 済みの二次元配列（1行目ヘッダー）から請求行を抽出
 */
export function extractBillingRowsFromMatrix(
  matrix: string[][]
): ParsedBillingCsv {
  const warnings: string[] = []
  if (matrix.length < 2) {
    return {
      rows: [],
      warnings: ["CSVにデータ行がありません。ご確認ください。"],
    }
  }

  const headers = matrix[0].map((h) => String(h ?? ""))
  const clientIdx = findColumnIndex(headers, CLIENT_ALIASES)
  const dateIdx = findColumnIndex(headers, DATE_ALIASES)
  const startIdx = findColumnIndex(headers, START_ALIASES)
  const endIdx = findColumnIndex(headers, END_ALIASES)
  const rangeIdx = findColumnIndex(headers, TIME_RANGE_ALIASES)

  if (clientIdx < 0) {
    warnings.push(
      "「利用者」列が見つかりませんでした。列名をご確認ください。"
    )
  }
  if (dateIdx < 0) {
    warnings.push("「日付」列が見つかりませんでした。列名をご確認ください。")
  }
  if (startIdx < 0 && endIdx < 0 && rangeIdx < 0) {
    warnings.push(
      "「サービス提供時間」または開始・終了列が見つかりませんでした。"
    )
  }

  const rows: BillingCsvRow[] = []

  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i]
    if (!line || line.every((cell) => String(cell ?? "").trim() === "")) {
      continue
    }

    const clientLabel =
      clientIdx >= 0 ? String(line[clientIdx] ?? "").trim() : ""
    const serviceDate =
      dateIdx >= 0 ? normalizeDate(String(line[dateIdx] ?? "")) : ""

    let startHm = ""
    let endHm = ""

    if (rangeIdx >= 0) {
      const parsed = parseTimeRange(String(line[rangeIdx] ?? ""))
      if (parsed) {
        startHm = parsed.start
        endHm = parsed.end
      }
    }
    if (!startHm && startIdx >= 0) {
      startHm = normalizeHm(String(line[startIdx] ?? ""))
    }
    if (!endHm && endIdx >= 0) {
      endHm = normalizeHm(String(line[endIdx] ?? ""))
    }

    if (!clientLabel && !serviceDate && !startHm && !endHm) continue

    rows.push({
      clientLabel,
      serviceDate,
      startHm,
      endHm,
      sourceRow: i + 1,
    })
  }

  return { rows, warnings }
}

function findBestRecord(
  row: BillingCsvRow,
  records: ServiceRecordForReconcile[]
): ServiceRecordForReconcile | null {
  const key = normalizeClientKey(row.clientLabel)
  const candidates = records.filter(
    (r) =>
      r.service_date === row.serviceDate &&
      normalizeClientKey(r.client_label) === key
  )
  if (candidates.length === 0) return null

  const exact = candidates.find(
    (r) =>
      isoToHm(r.start_at) === row.startHm && isoToHm(r.end_at) === row.endHm
  )
  if (exact) return exact

  // 開始時刻が最も近いものを警告用に採用
  return [...candidates].sort((a, b) => {
    const da = Math.abs(hmToMinutes(isoToHm(a.start_at)) - hmToMinutes(row.startHm))
    const db = Math.abs(hmToMinutes(isoToHm(b.start_at)) - hmToMinutes(row.startHm))
    return da - db
  })[0]
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map((n) => Number(n))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return h * 60 + m
}

/**
 * CSV行と日報を1分単位で突合
 */
export function reconcileBillingWithRecords(
  billingRows: BillingCsvRow[],
  records: ServiceRecordForReconcile[]
): BillingReconcileResult[] {
  return billingRows.map((row) => {
    if (!row.clientLabel || !row.serviceDate || !row.startHm || !row.endHm) {
      return {
        clientLabel: row.clientLabel || "（未取得）",
        serviceDate: row.serviceDate || "—",
        billingStart: row.startHm || "—",
        billingEnd: row.endHm || "—",
        recordStart: null,
        recordEnd: null,
        status: "mismatch" as const,
        warning:
          "CSVから利用者・日付・提供時間を読み取れませんでした。列構成をご確認ください。",
        sourceRow: row.sourceRow,
      }
    }

    const matched = findBestRecord(row, records)
    if (!matched) {
      return {
        clientLabel: row.clientLabel,
        serviceDate: row.serviceDate,
        billingStart: row.startHm,
        billingEnd: row.endHm,
        recordStart: null,
        recordEnd: null,
        status: "missing" as const,
        warning: `日報に該当する記録が見つかりませんでした（請求: ${row.startHm}〜${row.endHm}）。ご確認ください。`,
        sourceRow: row.sourceRow,
      }
    }

    const recordStart = isoToHm(matched.start_at)
    const recordEnd = isoToHm(matched.end_at)
    const exact =
      recordStart === row.startHm && recordEnd === row.endHm

    if (exact) {
      return {
        clientLabel: row.clientLabel,
        serviceDate: row.serviceDate,
        billingStart: row.startHm,
        billingEnd: row.endHm,
        recordStart,
        recordEnd,
        status: "exact" as const,
        warning: null,
        sourceRow: row.sourceRow,
      }
    }

    return {
      clientLabel: row.clientLabel,
      serviceDate: row.serviceDate,
      billingStart: row.startHm,
      billingEnd: row.endHm,
      recordStart,
      recordEnd,
      status: "mismatch" as const,
      warning: `1分単位でズレがある可能性があります。請求: ${row.startHm}〜${row.endHm} / 日報: ${recordStart}〜${recordEnd}`,
      sourceRow: row.sourceRow,
    }
  })
}
