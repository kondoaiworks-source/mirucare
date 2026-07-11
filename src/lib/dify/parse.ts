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
    return parsed as DifyFindingItem[]
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.findings)) {
      return obj.findings as DifyFindingItem[]
    }
    if (Array.isArray(obj.items)) {
      return obj.items as DifyFindingItem[]
    }
    if (Array.isArray(obj.results)) {
      return obj.results as DifyFindingItem[]
    }
  }
  return null
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
