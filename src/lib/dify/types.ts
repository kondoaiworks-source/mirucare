import type { FindingSeverity } from "@/types/database"
import type {
  FindingCheckType,
  FindingComparisonItem,
} from "@/lib/check/check-type"

/** Dify が返す想定の指摘1件 */
export type DifyFindingItem = {
  severity?: string
  title?: string
  description?: string
  basis?: string
  suggestion?: string
  checkType?: FindingCheckType
  ruleCode?: string
  ruleVersionId?: string
  ruleTitle?: string
  ruleVersionNo?: number
  auditItem?: string
  checkAsOf?: string
  comparison?: FindingComparisonItem[]
}

export type DifyCheckResult = {
  findings: DifyFindingItem[]
  rawText: string
  parseOk: boolean
  usedFallback: boolean
}

export type DifyCheckInput = {
  /** 市区町村名（ローカル基準）。未設定時は国基準 */
  municipality: string
  /** 都道府県名 */
  prefecture: string
  /** 国基準フラグ（"1"=国基準 / "0"=自治体基準） */
  national: "0" | "1"
  docType: string
  /** PDF/CSV 等から抽出したテキスト */
  documentText?: string
  /** 画像をビジョン入力する場合の base64（data URL 可） */
  imageBase64?: string
  imageMimeType?: string
  /** 承認済み AI 判定ルール（JSON文字列） */
  approvedRulesJson?: string
  /** 根拠資料タイトル等一覧（JSON文字列） */
  regulatoryBasisJson?: string
  /** チェック基準日 YYYY-MM-DD */
  checkAsOf?: string
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
