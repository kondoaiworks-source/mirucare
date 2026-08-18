import { createHash } from "node:crypto"

/** approved_rules_json 全体の上限（既存仕様） */
export const APPROVED_RULES_JSON_MAX_CHARS = 60_000
/** 1ルール guidance の下限（極端な細切れを防ぐ） */
export const GUIDANCE_MIN_CHARS = 1_000
/** 1ルールの目安 */
export const GUIDANCE_PREFERRED_CHARS = 3_000
/** 1ルールの上限 */
export const GUIDANCE_MAX_CHARS = 5_000
/** DB から読むときの安全キャップ（Dify 送信上限とは別） */
export const DB_GUIDANCE_LOAD_MAX_CHARS = 20_000

/**
 * 後半に残りやすい監査条件。元本文に無い語は足さない。
 * ヒットした文（または段落）を優先して残す。
 */
export const GUIDANCE_PRIORITY_KEYWORDS = [
  "必須",
  "しなければならない",
  "記録要件",
  "保存要件",
  "算定要件",
  "減算",
  "返戻",
  "請求対象外",
  "禁止",
  "例外",
  "例外条件",
  "実地指導",
  "運営指導",
  "確認事項",
] as const

export type GuidanceExtractResult = {
  text: string
  truncated: boolean
  originalLength: number
  originalHash: string
}

export function hashGuidanceText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 24)
}

export function perRuleGuidanceBudget(ruleCount: number): number {
  const n = Math.max(1, ruleCount)
  const envelopePerRule = 280
  const available = APPROVED_RULES_JSON_MAX_CHARS - 80 - n * envelopePerRule
  const even = Math.floor(available / n)
  return clamp(even, GUIDANCE_MIN_CHARS, GUIDANCE_MAX_CHARS)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function splitGuidanceUnits(text: string): string[] {
  const paras = text.split(/\n{2,}/)
  const units: string[] = []
  for (const para of paras) {
    const parts = para.split(/(?<=。)/)
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed) units.push(trimmed)
    }
  }
  return units.length > 0 ? units : text.trim() ? [text.trim()] : []
}

function isPriorityUnit(unit: string): boolean {
  return GUIDANCE_PRIORITY_KEYWORDS.some((kw) => unit.includes(kw))
}

/**
 * 文字数制限時も先頭切り捨てだけにしない。
 * 優先キーワードを含む箇所と、前後の文脈・末尾を元本文から抜き出す。
 */
export function extractPriorityGuidance(
  raw: string,
  maxChars: number
): GuidanceExtractResult {
  const src = raw.trim()
  const originalLength = src.length
  const originalHash = hashGuidanceText(src)
  if (originalLength === 0) {
    return { text: "", truncated: false, originalLength, originalHash }
  }
  if (originalLength <= maxChars) {
    return { text: src, truncated: false, originalLength, originalHash }
  }

  const units = splitGuidanceUnits(src).map((unit) =>
    unit.length > maxChars ? windowAroundPriority(unit, maxChars) : unit
  )
  const selected = new Set<number>()

  const buildText = (indices: number[]) =>
    indices
      .sort((a, b) => a - b)
      .map((i) => units[i])
      .join("\n")

  const tryAdd = (i: number): boolean => {
    if (i < 0 || i >= units.length) return false
    if (selected.has(i)) return true
    const next = buildText(Array.from(selected).concat(i))
    if (next.length > maxChars) return false
    selected.add(i)
    return true
  }

  const priorityIdx = units
    .map((u, i) => (isPriorityUnit(u) ? i : -1))
    .filter((i) => i >= 0)
  for (const i of priorityIdx) tryAdd(i)

  if (units.length > 0) tryAdd(0)
  if (units.length > 1) tryAdd(1)
  if (units.length > 2) tryAdd(units.length - 1)
  if (units.length > 3) tryAdd(units.length - 2)

  for (let i = 0; i < units.length; i++) {
    tryAdd(i)
  }

  let text = buildText(Array.from(selected))
  if (!text) {
    text = windowAroundPriority(src, maxChars)
  }
  if (text.length > maxChars) {
    text = text.slice(0, maxChars)
  }
  return {
    text,
    truncated: true,
    originalLength,
    originalHash,
  }
}

/** 1文が上限超のとき、優先語の周辺だけを元本文から切り出す */
function windowAroundPriority(unit: string, maxChars: number): string {
  if (unit.length <= maxChars) return unit
  let hit = -1
  for (const kw of GUIDANCE_PRIORITY_KEYWORDS) {
    const i = unit.indexOf(kw)
    if (i >= 0) {
      hit = i
      break
    }
  }
  if (hit < 0) return unit.slice(0, maxChars)
  const pad = Math.floor((maxChars - 8) / 2)
  const start = Math.max(0, hit - pad)
  return unit.slice(start, start + maxChars)
}
