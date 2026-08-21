/**
 * チェック結果の2行サマリ。
 * 整合性＝書類同士の標準観点 / ルール＝ルールブック（国・県＋その市）。
 * 合否や「足りていること」の保証ではない。
 */

import { ALIGNMENT_CATALOG, BUILTIN_ALIGNMENT_CODES } from "@/lib/check/alignment-catalog"
import { countFindingsByCheckType } from "@/lib/check/check-type"
import type { AppliedRulesSnapshot } from "@/types/database"

export type CheckRunSummary = {
  /** 書類同士で見た観点の数（標準カタログ） */
  consistencyCheckedCount: number
  /** 整合性の気になる点 */
  consistencyFindingCount: number
  /**
   * ルールブックから渡した件数（組み込みの整合観点を除く）。
   * スナップショットが無い旧データは null。
   */
  rulebookRuleCount: number | null
  /** ルールブック由来の気になる点 */
  ruleFindingCount: number
  unsetFindingCount: number
  truncated: boolean
  snapshotMissing: boolean
}

export function countRulebookRulesFromSnapshot(
  snapshot: AppliedRulesSnapshot | null | undefined
): number | null {
  if (!snapshot) return null
  const rows = snapshot.rules ?? []
  if (rows.length > 0) {
    return rows.filter((r) => !BUILTIN_ALIGNMENT_CODES.has(r.code)).length
  }
  if (typeof snapshot.ruleCount === "number") {
    return snapshot.ruleCount
  }
  return 0
}

export function buildCheckRunSummary(input: {
  findings: Array<{
    check_type?: string | null
    source_kind?: string | null
    rule_code?: string | null
    rule_version_id?: string | null
  }>
  snapshot?: AppliedRulesSnapshot | null
}): CheckRunSummary {
  const counts = countFindingsByCheckType(input.findings)
  const snapshot = input.snapshot ?? null
  const snapshotMissing = snapshot == null
  const rulebookRuleCount = countRulebookRulesFromSnapshot(snapshot)

  return {
    consistencyCheckedCount: ALIGNMENT_CATALOG.length,
    consistencyFindingCount: counts.consistency,
    rulebookRuleCount,
    ruleFindingCount: counts.rule,
    unsetFindingCount: counts.unset,
    truncated: Boolean(snapshot?.truncated),
    snapshotMissing,
  }
}
