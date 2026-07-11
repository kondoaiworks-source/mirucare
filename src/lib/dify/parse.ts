import type { DifyCheckResult, DifyFindingItem } from "./types"
import { CHECK_UI } from "@/lib/copy/check-ui"

const MAX_PARSE_RETRIES = 2

/**
 * Dify 応答テキストから findings JSON を抽出する。
 * コードフェンスや前後の説明文があっても可能な限り拾う。
 */
export function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  // ```json ... ``` を優先
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  // 全体が JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed
  }

  // 最初の { 〜 最後の } 
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1)
  }

  return null
}

function coerceFindings(parsed: unknown): DifyFindingItem[] | null {
  if (Array.isArray(parsed)) {
    return parsed.map(normalizeFindingItem)
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.findings)) {
      return obj.findings.map(normalizeFindingItem)
    }
    if (Array.isArray(obj.items)) {
      return obj.items.map(normalizeFindingItem)
    }
    if (Array.isArray(obj.results)) {
      return obj.results.map(normalizeFindingItem)
    }
  }
  return null
}

/** Dify が basis をオブジェクトで返す場合などに文字列へ揃える */
function normalizeFindingItem(raw: unknown): DifyFindingItem {
  if (!raw || typeof raw !== "object") {
    return {}
  }
  const f = raw as Record<string, unknown>
  return {
    severity: typeof f.severity === "string" ? f.severity : undefined,
    title: typeof f.title === "string" ? f.title : undefined,
    description: typeof f.description === "string" ? f.description : undefined,
    basis: fieldToText(f.basis),
    suggestion: fieldToText(f.suggestion),
  }
}

function fieldToText(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const parts: string[] = []
    if (typeof obj.source_name === "string" && obj.source_name.trim()) {
      parts.push(obj.source_name.trim())
    }
    if (typeof obj.quote === "string" && obj.quote.trim()) {
      parts.push(obj.quote.trim())
    }
    if (typeof obj.text === "string" && obj.text.trim()) {
      parts.push(obj.text.trim())
    }
    if (parts.length > 0) return parts.join("\n")
    try {
      return JSON.stringify(value)
    } catch {
      return undefined
    }
  }
  return undefined
}

export function parseDifyFindings(rawText: string): {
  findings: DifyFindingItem[]
  parseOk: boolean
} {
  const candidate = extractJsonCandidate(rawText)
  if (!candidate) {
    return { findings: [], parseOk: false }
  }

  try {
    const parsed = JSON.parse(candidate) as unknown
    const findings = coerceFindings(parsed)
    if (!findings) {
      return { findings: [], parseOk: false }
    }
    // 最低限 title か description があるものだけ採用
    const cleaned = findings.filter(
      (f) =>
        (typeof f.title === "string" && f.title.trim()) ||
        (typeof f.description === "string" && f.description.trim())
    )
    return { findings: cleaned, parseOk: true }
  } catch {
    return { findings: [], parseOk: false }
  }
}

/**
 * パース失敗時のフォールバック指摘
 */
export function buildFallbackFinding(): DifyFindingItem {
  return {
    severity: "mid",
    title: CHECK_UI.summaryFallback,
    description: CHECK_UI.summaryFallbackBody,
    basis: "システム",
    suggestion:
      "書類の日付・署名・同意欄など、実地指導（運営指導）で確認されやすい箇所を目視でご確認ください。",
  }
}

/**
 * リトライ付きパース。失敗時はフォールバック1件。
 */
export function parseWithRetryAndFallback(
  rawText: string,
  repairAttempts: string[] = []
): DifyCheckResult {
  const attempts = [rawText, ...repairAttempts]
  let lastRaw = rawText

  for (let i = 0; i < Math.min(attempts.length, MAX_PARSE_RETRIES + 1); i++) {
    lastRaw = attempts[i] ?? rawText
    const { findings, parseOk } = parseDifyFindings(lastRaw)
    if (parseOk) {
      return {
        findings,
        rawText: lastRaw,
        parseOk: true,
        usedFallback: false,
      }
    }
  }

  return {
    findings: [buildFallbackFinding()],
    rawText: lastRaw,
    parseOk: false,
    usedFallback: true,
  }
}
