/**
 * 監査カテゴリ（運用チェック単位）
 * Phase1 は 4 固定。将来の追加に備え slug ベースで管理する。
 * @see src/lib/phase1-audit.ts
 */

import { PHASE1_OPERATION_CHECKS } from "@/lib/phase1-audit"
import { getPhase1ExpectedRules } from "@/lib/rule-engine/phase1-rule-groups"

export type AuditCategoryDef = {
  /** URL用（安定キー） */
  slug: string
  /** Phase1 項目番号。将来カテゴリは null 可 */
  operationCheckNo: number | null
  title: string
  description: string
  /** 関連ルール code の推定キーワード（絞り込み用） */
  titleKeywords: string[]
}

/**
 * 現行の監査カテゴリ一覧。
 * 追加時は末尾に足し、slug は変更しないこと。
 */
export const AUDIT_CATEGORIES: readonly AuditCategoryDef[] = [
  {
    slug: "care-plan",
    operationCheckNo: 1,
    title: PHASE1_OPERATION_CHECKS[0].title,
    description: PHASE1_OPERATION_CHECKS[0].description,
    titleKeywords: ["ケアプラン", "訪問介護計画", "計画書"],
  },
  {
    slug: "plan-record",
    operationCheckNo: 3,
    title: PHASE1_OPERATION_CHECKS[1].title,
    description: PHASE1_OPERATION_CHECKS[1].description,
    titleKeywords: ["提供記録", "サービス提供", "実績", "計画"],
  },
  {
    slug: "shift-record",
    operationCheckNo: 7,
    title: PHASE1_OPERATION_CHECKS[2].title,
    description: PHASE1_OPERATION_CHECKS[2].description,
    titleKeywords: ["シフト", "勤務表", "勤務形態", "提供記録"],
  },
  {
    slug: "billing-record",
    operationCheckNo: 8,
    title: PHASE1_OPERATION_CHECKS[3].title,
    description: PHASE1_OPERATION_CHECKS[3].description,
    titleKeywords: ["請求", "国保連", "実績"],
  },
] as const

export function getAuditCategoryBySlug(
  slug: string
): AuditCategoryDef | undefined {
  return AUDIT_CATEGORIES.find((c) => c.slug === slug)
}

export function isAuditCategorySlug(slug: string): boolean {
  return Boolean(getAuditCategoryBySlug(slug))
}

/** カテゴリに属する判定ルール code 一覧（Phase1 マッピング） */
export function getRuleCodesForAuditCategory(slug: string): string[] {
  const cat = getAuditCategoryBySlug(slug)
  if (!cat || cat.operationCheckNo == null) return []
  return getPhase1ExpectedRules()
    .filter((r) => r.operationCheckNo === cat.operationCheckNo)
    .map((r) => r.code)
}

export function ruleMatchesAuditCategory(
  rule: { code: string; title: string },
  category: AuditCategoryDef
): boolean {
  const codes = getRuleCodesForAuditCategory(category.slug)
  if (codes.includes(rule.code)) return true
  const hay = rule.title.toLowerCase()
  return category.titleKeywords.some((kw) =>
    hay.includes(kw.toLowerCase())
  )
}
