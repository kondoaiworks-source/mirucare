/**
 * 介護ソフトCSV → 勤怠・日報・シフト取込用パーサ（ブラウザ側）
 * 請求CSVとは別。取込確定時のみ構造化データをサーバーへ送る（生CSVは保存しない）
 */

import { normalizeDate, normalizeHm } from "@/lib/billing/reconcile"

export type AttendanceImportKind =
  | "helpers"
  | "attendance"
  | "service_records"
  | "shifts"

export type CareSoftPresetId =
  | "generic"
  | "honobono"
  | "kaipoke"
  | "wiseman"

export type ParsedHelperRow = {
  sourceRow: number
  displayName: string
  employeeCode: string | null
}

export type ParsedAttendanceRow = {
  sourceRow: number
  helperName: string
  employeeCode: string | null
  workDate: string
  clockInHm: string
  clockOutHm: string
}

export type ParsedServiceRecordRow = {
  sourceRow: number
  helperName: string
  employeeCode: string | null
  clientLabel: string
  serviceDate: string
  startHm: string
  endHm: string
}

export type ParsedShiftRow = {
  sourceRow: number
  helperName: string
  employeeCode: string | null
  workDate: string
  startHm: string
  endHm: string
  note: string | null
}

export type AttendanceParseIssue = {
  sourceRow: number
  message: string
}

type ColumnMap = {
  helperName: readonly string[]
  employeeCode: readonly string[]
  clientLabel: readonly string[]
  date: readonly string[]
  start: readonly string[]
  end: readonly string[]
  clockIn: readonly string[]
  clockOut: readonly string[]
  timeRange: readonly string[]
  note: readonly string[]
}

const BASE_MAP: ColumnMap = {
  helperName: [
    "ヘルパー",
    "ヘルパー名",
    "職員名",
    "介護職員",
    "担当者",
    "従業員名",
    "スタッフ名",
    "訪問介護員",
  ],
  employeeCode: [
    "職員コード",
    "従業員番号",
    "社員番号",
    "スタッフコード",
    "ヘルパーコード",
    "職員番号",
    "employee_code",
  ],
  clientLabel: [
    "利用者",
    "利用者名",
    "お客様",
    "顧客名",
    "サービス利用者",
  ],
  date: [
    "日付",
    "勤務日",
    "サービス提供日",
    "提供日",
    "実施日",
    "年月日",
    "シフト日",
  ],
  start: ["開始", "開始時間", "開始時刻", "サービス開始", "シフト開始"],
  end: ["終了", "終了時間", "終了時刻", "サービス終了", "シフト終了"],
  clockIn: ["出勤", "出勤時刻", "出勤時間", "打刻開始", "始業", "clock_in"],
  clockOut: ["退勤", "退勤時刻", "退勤時間", "打刻終了", "終業", "clock_out"],
  timeRange: ["サービス提供時間", "提供時間", "勤務時間", "シフト時間"],
  note: ["備考", "メモ", "コメント", "note"],
}

/** 介護ソフト別の列名ゆれ（generic に追加マージ） */
const PRESET_EXTRA: Record<CareSoftPresetId, Partial<ColumnMap>> = {
  generic: {},
  honobono: {
    helperName: ["担当ヘルパー", "サービス提供者"],
    clientLabel: ["利用者氏名"],
    date: ["サービス年月日"],
  },
  kaipoke: {
    helperName: ["スタッフ", "担当スタッフ"],
    employeeCode: ["スタッフID"],
    clientLabel: ["利用者さん"],
  },
  wiseman: {
    helperName: ["従業者氏名", "サービス従業者"],
    employeeCode: ["従業者番号"],
    clientLabel: ["被保険者氏名"],
  },
}

export const CARE_SOFT_PRESETS: {
  id: CareSoftPresetId
  label: string
  description: string
}[] = [
  {
    id: "generic",
    label: "汎用（標準列名）",
    description: "多くの介護ソフトのCSV書き出しに対応します",
  },
  {
    id: "honobono",
    label: "ほのぼの系",
    description: "「サービス年月日」「担当ヘルパー」などの列名を優先します",
  },
  {
    id: "kaipoke",
    label: "カイポケ系",
    description: "「スタッフ」「スタッフID」などの列名を優先します",
  },
  {
    id: "wiseman",
    label: "ワイズマン系",
    description: "「従業者氏名」「従業者番号」などの列名を優先します",
  },
]

function mergeMap(preset: CareSoftPresetId): ColumnMap {
  const extra = PRESET_EXTRA[preset]
  return {
    helperName: [...(extra.helperName ?? []), ...BASE_MAP.helperName],
    employeeCode: [...(extra.employeeCode ?? []), ...BASE_MAP.employeeCode],
    clientLabel: [...(extra.clientLabel ?? []), ...BASE_MAP.clientLabel],
    date: [...(extra.date ?? []), ...BASE_MAP.date],
    start: [...(extra.start ?? []), ...BASE_MAP.start],
    end: [...(extra.end ?? []), ...BASE_MAP.end],
    clockIn: [...(extra.clockIn ?? []), ...BASE_MAP.clockIn],
    clockOut: [...(extra.clockOut ?? []), ...BASE_MAP.clockOut],
    timeRange: [...(extra.timeRange ?? []), ...BASE_MAP.timeRange],
    note: [...(extra.note ?? []), ...BASE_MAP.note],
  }
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "").replace(/　/g, "")
}

function findColumnIndex(
  headers: string[],
  aliases: readonly string[]
): number {
  const normalized = headers.map(normalizeHeader)
  for (const alias of aliases) {
    const target = normalizeHeader(alias)
    const idx = normalized.findIndex(
      (h) => h === target || h.includes(target) || target.includes(h)
    )
    if (idx >= 0) return idx
  }
  return -1
}

function cell(line: string[], idx: number): string {
  if (idx < 0) return ""
  return String(line[idx] ?? "").trim()
}

function parseTimeRange(raw: string): { start: string; end: string } | null {
  const m = raw
    .trim()
    .match(
      /(\d{1,2}:\d{2}(?::\d{2})?)\s*[〜~\-－–—]\s*(\d{1,2}:\d{2}(?::\d{2})?)/
    )
  if (!m) return null
  const start = normalizeHm(m[1])
  const end = normalizeHm(m[2])
  if (!start || !end) return null
  return { start, end }
}

function resolveStartEnd(
  line: string[],
  startIdx: number,
  endIdx: number,
  rangeIdx: number
): { start: string; end: string } {
  if (rangeIdx >= 0) {
    const parsed = parseTimeRange(cell(line, rangeIdx))
    if (parsed) return parsed
  }
  return {
    start: startIdx >= 0 ? normalizeHm(cell(line, startIdx)) : "",
    end: endIdx >= 0 ? normalizeHm(cell(line, endIdx)) : "",
  }
}

export function detectImportKind(
  headers: string[],
  preset: CareSoftPresetId = "generic"
): AttendanceImportKind | null {
  const map = mergeMap(preset)
  const hasClient = findColumnIndex(headers, map.clientLabel) >= 0
  const hasClockIn = findColumnIndex(headers, map.clockIn) >= 0
  const hasClockOut = findColumnIndex(headers, map.clockOut) >= 0
  const hasDate = findColumnIndex(headers, map.date) >= 0
  const hasHelper =
    findColumnIndex(headers, map.helperName) >= 0 ||
    findColumnIndex(headers, map.employeeCode) >= 0
  const hasStart =
    findColumnIndex(headers, map.start) >= 0 ||
    findColumnIndex(headers, map.timeRange) >= 0
  const hasShiftHint = headers.some((h) =>
    normalizeHeader(h).includes("シフト")
  )

  if (hasClient && hasDate && (hasStart || hasHelper)) {
    return "service_records"
  }
  if (hasClockIn && hasClockOut) return "attendance"
  if (hasShiftHint && hasDate && hasStart) return "shifts"
  if (hasDate && hasStart && hasHelper && !hasClient) return "shifts"
  if (hasHelper && !hasDate) return "helpers"
  return null
}

export function importKindLabel(kind: AttendanceImportKind): string {
  switch (kind) {
    case "helpers":
      return "ヘルパー一覧"
    case "attendance":
      return "タイムカード（勤怠）"
    case "service_records":
      return "サービス提供記録（日報）"
    case "shifts":
      return "シフト"
  }
}

export type ParsedAttendanceImport =
  | {
      kind: "helpers"
      rows: ParsedHelperRow[]
      issues: AttendanceParseIssue[]
    }
  | {
      kind: "attendance"
      rows: ParsedAttendanceRow[]
      issues: AttendanceParseIssue[]
    }
  | {
      kind: "service_records"
      rows: ParsedServiceRecordRow[]
      issues: AttendanceParseIssue[]
    }
  | {
      kind: "shifts"
      rows: ParsedShiftRow[]
      issues: AttendanceParseIssue[]
    }

export function parseAttendanceImportMatrix(
  matrix: string[][],
  options: {
    kind?: AttendanceImportKind | null
    preset?: CareSoftPresetId
  } = {}
): ParsedAttendanceImport | { error: string } {
  if (matrix.length < 2) {
    return { error: "CSVにデータ行がありません。ご確認ください。" }
  }

  const preset = options.preset ?? "generic"
  const headers = matrix[0].map((h) => String(h ?? ""))
  const kind = options.kind ?? detectImportKind(headers, preset)
  if (!kind) {
    return {
      error:
        "CSVの種類を判定できませんでした。介護ソフトの種類を選ぶか、列名（ヘルパー・日付・出勤／退勤・利用者など）をご確認ください。",
    }
  }

  const map = mergeMap(preset)
  const helperIdx = findColumnIndex(headers, map.helperName)
  const codeIdx = findColumnIndex(headers, map.employeeCode)
  const clientIdx = findColumnIndex(headers, map.clientLabel)
  const dateIdx = findColumnIndex(headers, map.date)
  const startIdx = findColumnIndex(headers, map.start)
  const endIdx = findColumnIndex(headers, map.end)
  const clockInIdx = findColumnIndex(headers, map.clockIn)
  const clockOutIdx = findColumnIndex(headers, map.clockOut)
  const rangeIdx = findColumnIndex(headers, map.timeRange)
  const noteIdx = findColumnIndex(headers, map.note)

  const issues: AttendanceParseIssue[] = []

  if (kind === "helpers") {
    const rows: ParsedHelperRow[] = []
    for (let i = 1; i < matrix.length; i++) {
      const line = matrix[i]
      if (!line || line.every((c) => String(c ?? "").trim() === "")) continue
      const displayName = cell(line, helperIdx)
      const employeeCode = cell(line, codeIdx) || null
      const sourceRow = i + 1
      if (!displayName && !employeeCode) {
        issues.push({
          sourceRow,
          message: "氏名または職員コードが空です",
        })
        continue
      }
      if (!displayName) {
        issues.push({
          sourceRow,
          message: "ヘルパー名が空です",
        })
        continue
      }
      rows.push({ sourceRow, displayName, employeeCode })
    }
    return { kind, rows, issues }
  }

  if (kind === "attendance") {
    const rows: ParsedAttendanceRow[] = []
    for (let i = 1; i < matrix.length; i++) {
      const line = matrix[i]
      if (!line || line.every((c) => String(c ?? "").trim() === "")) continue
      const sourceRow = i + 1
      const helperName = cell(line, helperIdx)
      const employeeCode = cell(line, codeIdx) || null
      const workDate = normalizeDate(cell(line, dateIdx))
      const clockInHm = normalizeHm(cell(line, clockInIdx))
      const clockOutHm = normalizeHm(cell(line, clockOutIdx))

      if (!helperName && !employeeCode) {
        issues.push({ sourceRow, message: "ヘルパーを特定できません" })
        continue
      }
      if (!workDate || !clockInHm || !clockOutHm) {
        issues.push({
          sourceRow,
          message: "日付・出勤・退勤のいずれかを読み取れませんでした",
        })
        continue
      }
      rows.push({
        sourceRow,
        helperName: helperName || employeeCode || "",
        employeeCode,
        workDate,
        clockInHm,
        clockOutHm,
      })
    }
    return { kind, rows, issues }
  }

  if (kind === "service_records") {
    const rows: ParsedServiceRecordRow[] = []
    for (let i = 1; i < matrix.length; i++) {
      const line = matrix[i]
      if (!line || line.every((c) => String(c ?? "").trim() === "")) continue
      const sourceRow = i + 1
      const helperName = cell(line, helperIdx)
      const employeeCode = cell(line, codeIdx) || null
      const clientLabel = cell(line, clientIdx)
      const serviceDate = normalizeDate(cell(line, dateIdx))
      const { start, end } = resolveStartEnd(line, startIdx, endIdx, rangeIdx)

      if (!helperName && !employeeCode) {
        issues.push({ sourceRow, message: "ヘルパーを特定できません" })
        continue
      }
      if (!clientLabel || !serviceDate || !start || !end) {
        issues.push({
          sourceRow,
          message:
            "利用者・日付・提供時間のいずれかを読み取れませんでした",
        })
        continue
      }
      rows.push({
        sourceRow,
        helperName: helperName || employeeCode || "",
        employeeCode,
        clientLabel,
        serviceDate,
        startHm: start,
        endHm: end,
      })
    }
    return { kind, rows, issues }
  }

  // shifts
  const rows: ParsedShiftRow[] = []
  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i]
    if (!line || line.every((c) => String(c ?? "").trim() === "")) continue
    const sourceRow = i + 1
    const helperName = cell(line, helperIdx)
    const employeeCode = cell(line, codeIdx) || null
    const workDate = normalizeDate(cell(line, dateIdx))
    const { start, end } = resolveStartEnd(line, startIdx, endIdx, rangeIdx)
    const note = cell(line, noteIdx) || null

    if (!helperName && !employeeCode) {
      issues.push({ sourceRow, message: "ヘルパーを特定できません" })
      continue
    }
    if (!workDate || !start || !end) {
      issues.push({
        sourceRow,
        message: "日付・開始・終了のいずれかを読み取れませんでした",
      })
      continue
    }
    rows.push({
      sourceRow,
      helperName: helperName || employeeCode || "",
      employeeCode,
      workDate,
      startHm: start,
      endHm: end,
      note,
    })
  }
  return { kind: "shifts", rows, issues }
}

/** YYYY-MM-DD + HH:mm → ISO（Asia/Tokyo 想定のオフセット付き） */
export function toTokyoIso(date: string, hm: string): string {
  return `${date}T${hm}:00+09:00`
}
