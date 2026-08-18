/**
 * 将来拡張：ルール本文を「監査チェック項目」単位で扱うための形。
 * 今回の DB には未実装。Dify へは従来どおり guidance 1本を送る。
 * 項目分解するときは、この型に載せて serialize 側だけ差し替えられる想定。
 */

import type { FindingSeverity } from "@/types/database"

export type FutureRuleCheckItem = {
  checkId: string
  requirement: string
  condition?: string
  exception?: string
  severity: FindingSeverity
  auditItem?: string | null
  regulatoryBasis?: string | null
}

export type FutureRuleWithCheckItems = {
  ruleCode: string
  title: string
  versionId: string
  versionNo: number
  checkItems: FutureRuleCheckItem[]
}
