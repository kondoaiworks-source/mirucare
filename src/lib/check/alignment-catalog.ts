/**
 * 書類同士の標準観点カタログ（ルールブック非依存）。
 * 追加はコード＋テスト。チェック実行はここを回すだけ。
 */

import type { DifyFindingItem } from "@/lib/dify/types"
import type { ResolvedCheckRule } from "@/lib/rule-engine/resolve-check-rules"
import {
  findPlanDateAlignmentFinding,
  isSimilarPlanDateFinding,
  PLAN_DATE_ALIGNMENT_CODE,
  builtinPlanDateAlignmentRule,
} from "@/lib/check/plan-date-alignment"
import {
  CONSENT_DATE_ALIGNMENT_CODE,
  CONSENT_DATE_ALIGNMENT_VERSION_ID,
  findConsentDateAlignmentFinding,
  isSimilarConsentDateFinding,
} from "@/lib/check/consent-date-alignment"
import {
  findRecordBeforePlanFinding,
  isSimilarRecordBeforePlanFinding,
  RECORD_BEFORE_PLAN_CODE,
  RECORD_BEFORE_PLAN_VERSION_ID,
} from "@/lib/check/record-before-plan"
import {
  findServiceTimeOverlapFinding,
  isSimilarServiceTimeOverlapFinding,
  SERVICE_TIME_OVERLAP_CODE,
  SERVICE_TIME_OVERLAP_VERSION_ID,
} from "@/lib/check/service-time-overlap"

export type AlignmentCatalogItem = {
  code: string
  run: (texts: string[]) => DifyFindingItem | null
  isSimilar: (item: {
    title?: string | null
    description?: string | null
  }) => boolean
  builtinRule: () => ResolvedCheckRule
}

const MAX_APPROVED_RULES = 60

function builtinRule(
  code: string,
  versionId: string,
  title: string,
  guidanceText: string,
  severity: ResolvedCheckRule["severity"]
): ResolvedCheckRule {
  return {
    versionId,
    ruleId: versionId,
    code,
    title,
    versionNo: 1,
    guidanceText,
    severity,
    effectiveFrom: "2024-04-01",
    effectiveTo: null,
    auditItemTitle: "書類同士の整合",
    sourceTitle: "標準観点（ルールブック非依存）",
  }
}

export const ALIGNMENT_CATALOG: AlignmentCatalogItem[] = [
  {
    code: PLAN_DATE_ALIGNMENT_CODE,
    run: (texts) => findPlanDateAlignmentFinding(texts),
    isSimilar: isSimilarPlanDateFinding,
    builtinRule: builtinPlanDateAlignmentRule,
  },
  {
    code: SERVICE_TIME_OVERLAP_CODE,
    run: (texts) => findServiceTimeOverlapFinding(texts),
    isSimilar: isSimilarServiceTimeOverlapFinding,
    builtinRule: () =>
      builtinRule(
        SERVICE_TIME_OVERLAP_CODE,
        SERVICE_TIME_OVERLAP_VERSION_ID,
        "提供時間帯の重複の確認",
        "同じ日の提供記録で開始・終了時刻が重なっていないかご確認ください。",
        "high"
      ),
  },
  {
    code: RECORD_BEFORE_PLAN_CODE,
    run: (texts) => findRecordBeforePlanFinding(texts),
    isSimilar: isSimilarRecordBeforePlanFinding,
    builtinRule: () =>
      builtinRule(
        RECORD_BEFORE_PLAN_CODE,
        RECORD_BEFORE_PLAN_VERSION_ID,
        "計画前の提供日の確認",
        "訪問介護計画の作成・更新より前の提供日がないかご確認ください。",
        "high"
      ),
  },
  {
    code: CONSENT_DATE_ALIGNMENT_CODE,
    run: (texts) => findConsentDateAlignmentFinding(texts),
    isSimilar: isSimilarConsentDateFinding,
    builtinRule: () =>
      builtinRule(
        CONSENT_DATE_ALIGNMENT_CODE,
        CONSENT_DATE_ALIGNMENT_VERSION_ID,
        "同意日と開始日の確認",
        "同意日がサービス開始日より後になっていないかご確認ください。",
        "mid"
      ),
  },
]

export const BUILTIN_ALIGNMENT_CODES = new Set(
  ALIGNMENT_CATALOG.map((item) => item.code)
)

export function runAlignmentCatalog(texts: string[]): DifyFindingItem[] {
  const out: DifyFindingItem[] = []
  for (const item of ALIGNMENT_CATALOG) {
    const finding = item.run(texts)
    if (finding) out.push(finding)
  }
  return out
}

export function isCatalogAlignmentFinding(item: {
  title?: string | null
  description?: string | null
}): boolean {
  return ALIGNMENT_CATALOG.some((c) => c.isSimilar(item))
}

export function mergeAiFindingsWithCatalog(
  aiFindings: DifyFindingItem[],
  catalog: DifyFindingItem[]
): DifyFindingItem[] {
  if (catalog.length === 0) return aiFindings
  const rest = aiFindings.filter((f) => !isCatalogAlignmentFinding(f))
  return [...catalog, ...rest]
}

/** Dify 入力・スナップショットへ、セット内整合の標準観点を必ず載せる。 */
export function withBuiltinAlignmentRules(
  rules: ResolvedCheckRule[]
): ResolvedCheckRule[] {
  const builtins = ALIGNMENT_CATALOG.map((item) => item.builtinRule())
  const builtinCodes = new Set(builtins.map((r) => r.code))
  const rest = rules.filter((r) => !builtinCodes.has(r.code))
  return [...builtins, ...rest].slice(
    0,
    MAX_APPROVED_RULES + builtins.length
  )
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
