/**
 * セット内整合性カタログ用の日付・時刻ヘルパー。
 * 個人名・被保険者番号は扱わない（ログにも出さない）。
 */

const ERA_BASE: Record<string, number> = {
  令和: 2018,
  平成: 1988,
  昭和: 1925,
}

export const DATE_TOKEN_RE =
  /(令和|平成|昭和)\s*([元0-9０-９]{1,2})\s*年\s*([0-9０-９]{1,2})\s*月\s*([0-9０-９]{1,2})\s*日|(20[0-9]{2}|[０-９]{4})\s*年\s*([0-9０-９]{1,2})\s*月\s*([0-9０-９]{1,2})\s*日|(20[0-9]{2})[/\-.]([0-9]{1,2})[/\-.]([0-9]{1,2})/g

/** 13:00～14:30 / 13時00分〜14時30分 など */
export const TIME_RANGE_RE =
  /([0-9０-９]{1,2})\s*[:：時]\s*([0-9０-９]{0,2})\s*(?:分)?\s*[～〜~\-－−]\s*([0-9０-９]{1,2})\s*[:：時]\s*([0-9０-９]{0,2})\s*(?:分)?/g

export function joinTexts(text: string | string[] | null | undefined): string {
  if (Array.isArray(text)) {
    return text
      .map((t) => (t ?? "").trim())
      .filter(Boolean)
      .join("\n\n")
  }
  return (text ?? "").trim()
}

export function zenkakuToHankakuDigits(raw: string): string {
  return raw.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
  )
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function parseYearToken(raw: string): number | null {
  const t = zenkakuToHankakuDigits(raw).trim()
  if (t === "元") return 1
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 和暦・西暦の日付トークンを YYYY-MM-DD にする */
export function parseLabeledDate(raw: string): string | null {
  const text = zenkakuToHankakuDigits(raw).replace(/\s+/g, "")
  const era = text.match(/^(令和|平成|昭和)(元|\d{1,2})年(\d{1,2})月(\d{1,2})日$/)
  if (era) {
    const base = ERA_BASE[era[1] ?? ""]
    const y = parseYearToken(era[2] ?? "")
    const m = Number(era[3])
    const d = Number(era[4])
    if (base == null || y == null || m < 1 || m > 12 || d < 1 || d > 31) {
      return null
    }
    return `${base + y}-${pad2(m)}-${pad2(d)}`
  }
  const west = text.match(/^(20\d{2})年(\d{1,2})月(\d{1,2})日$/)
  if (west) {
    const m = Number(west[2])
    const d = Number(west[3])
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    return `${west[1]}-${pad2(m)}-${pad2(d)}`
  }
  const iso = text.match(/^(20\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
  if (iso) {
    const m = Number(iso[2])
    const d = Number(iso[3])
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    return `${iso[1]}-${pad2(m)}-${pad2(d)}`
  }
  return null
}

export function formatIsoDateJa(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${y}年${Number(m)}月${Number(d)}日`
}

export function formatMinutesJa(totalMin: number): string {
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${pad2(h)}:${pad2(m)}`
}

export function parseTimeToMinutes(
  hourRaw: string,
  minuteRaw: string
): number | null {
  const h = Number(zenkakuToHankakuDigits(hourRaw || "0"))
  const m = Number(zenkakuToHankakuDigits(minuteRaw || "0") || "0")
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

export function lastIndexOfAny(hay: string, needles: string[]): number {
  let best = -1
  for (const n of needles) {
    const i = hay.lastIndexOf(n)
    if (i > best) best = i
  }
  return best
}

/** 直前 CONTEXT 内で最も近い日付を YYYY-MM-DD で返す */
export function nearestDateBefore(
  src: string,
  index: number,
  contextChars = 120
): string | null {
  const before = src.slice(Math.max(0, index - contextChars), index)
  const re = new RegExp(DATE_TOKEN_RE.source, "g")
  let last: string | null = null
  let match: RegExpExecArray | null
  while ((match = re.exec(before))) {
    const iso = parseLabeledDate(match[0])
    if (iso) last = iso
  }
  return last
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  if (aEnd <= aStart || bEnd <= bStart) return false
  return aStart < bEnd && bStart < aEnd
}
