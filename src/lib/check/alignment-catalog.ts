/**
 * 書類同士の標準観点カタログ（ルールブック非依存）。
 * 追加はコード＋テスト。チェック実行はここを回すだけ。
 */

import type { DifyFindingItem } from "@/lib/dify/types"
import {
  findPlanDateAlignmentFinding,
  isSimilarPlanDateFinding,
  PLAN_DATE_ALIGNMENT_CODE,
} from "@/lib/check/plan-date-alignment"

export type AlignmentCatalogItem = {
  code: string
  run: (texts: string[]) => DifyFindingItem | null
}

export const ALIGNMENT_CATALOG: AlignmentCatalogItem[] = [
  {
    code: PLAN_DATE_ALIGNMENT_CODE,
    run: (texts) => findPlanDateAlignmentFinding(texts),
  },
]

export function runAlignmentCatalog(texts: string[]): DifyFindingItem[] {
  const out: DifyFindingItem[] = []
  for (const item of ALIGNMENT_CATALOG) {
    const finding = item.run(texts)
    if (finding) out.push(finding)
  }
  return out
}

export function mergeAiFindingsWithCatalog(
  aiFindings: DifyFindingItem[],
  catalog: DifyFindingItem[]
): DifyFindingItem[] {
  if (catalog.length === 0) return aiFindings
  const rest = aiFindings.filter((f) => !isSimilarPlanDateFinding(f))
  return [...catalog, ...rest]
}

export function pickCheckSetPrimaryId(
  docs: Array<{ id: string; created_at: string }>
): string | null {
  if (docs.length === 0) return null
  const sorted = [...docs].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  )
  return sorted[0]?.id ?? null
}
