import type { FindingSeverity } from "@/types/database"

/** Dify が返す想定の指摘1件 */
export type DifyFindingItem = {
  severity?: string
  title?: string
  description?: string
  basis?: string
  suggestion?: string
}

export type DifyCheckResult = {
  findings: DifyFindingItem[]
  rawText: string
  parseOk: boolean
  usedFallback: boolean
}

export type DifyCheckInput = {
  municipality: string
  serviceType: string
  docType: string
  /** PDF/CSV 等から抽出したテキスト */
  documentText?: string
  /** 画像をビジョン入力する場合の base64（data URL 可） */
  imageBase64?: string
  imageMimeType?: string
  /** モックシナリオ上書き */
  mockScenario?: MockScenario
}

export type MockScenario = "success" | "parse_error" | "empty" | "zero"

export function normalizeSeverity(raw: string | undefined): FindingSeverity {
  const v = (raw ?? "mid").toLowerCase()
  if (v === "high" || v === "高" || v === "critical") return "high"
  if (v === "low" || v === "低" || v === "info") return "low"
  return "mid"
}
