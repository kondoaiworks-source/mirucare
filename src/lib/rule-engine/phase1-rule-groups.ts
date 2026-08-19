import { PHASE1_AI_RULE_SEEDS } from "@/lib/phase1-ai-rules-seed"
import { PHASE1_OPERATION_CHECKS } from "@/lib/phase1-audit"

/** Phase1 判定ルール code → 運用AI監査の項目番号（1・3・7・8） */
const CODE_TO_OPERATION_CHECK: Record<string, 1 | 3 | 7 | 8> = {
  HC_PLAN_CARE_PLAN_ALIGNMENT: 1,
  HC_PLAN_GOAL_SETTING: 1,
  HC_PLAN_SERVICE_CONTENT: 1,
  HC_PLAN_ASSIGNEE: 1,
  HC_PLAN_UPDATED_DATE: 1,
  HC_RECORD_SERVICE_DATETIME: 3,
  HC_RECORD_SERVICE_CONTENT: 3,
  HC_RECORD_PHYSICAL_CARE: 3,
  HC_RECORD_LIFE_SUPPORT: 3,
  HC_RECORD_SPECIAL_NOTES: 3,
  HC_GOV_WORK_PATTERN_LIST: 7,
  HC_GOV_STAFFING_STANDARDS: 7,
  HC_BILLING_SERVICE_RECORD_MATCH: 8,
  HC_BILLING_ACTUAL_RESULT_MATCH: 8,
  HC_BILLING_MISSING_OR_ERROR: 8,
}

export type Phase1ExpectedRule = {
  code: string
  title: string
  auditItemCode: string
  operationCheckNo: 1 | 3 | 7 | 8
}

export function getPhase1ExpectedRules(): Phase1ExpectedRule[] {
  return PHASE1_AI_RULE_SEEDS.filter((seed) =>
    Boolean(CODE_TO_OPERATION_CHECK[seed.code])
  ).map((seed) => ({
    code: seed.code,
    title: seed.title,
    auditItemCode: seed.auditItemCode,
    operationCheckNo: CODE_TO_OPERATION_CHECK[seed.code] ?? (1 as const),
  }))
}

export function getPhase1OperationCheckMeta(no: 1 | 3 | 7 | 8) {
  return PHASE1_OPERATION_CHECKS.find((c) => c.no === no)
}

export function hasDocumentEvidenceInCheckLogic(
  checkLogic: Record<string, unknown> | null | undefined
): boolean {
  if (!checkLogic || typeof checkLogic !== "object") return false
  if (checkLogic.phase1 === true && !checkLogic.evidence) return false
  const evidence = checkLogic.evidence
  if (evidence && typeof evidence === "object") {
    const e = evidence as Record<string, unknown>
    if (typeof e.evidenceSummary === "string" && e.evidenceSummary.trim()) {
      return true
    }
    if (Array.isArray(e.evidenceQuotes) && e.evidenceQuotes.length > 0) {
      return true
    }
    if (typeof e.sourceTitle === "string" && e.sourceTitle.trim()) {
      return true
    }
  }
  return false
}
