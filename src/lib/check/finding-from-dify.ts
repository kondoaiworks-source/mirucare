import {
  formatComparisonText,
  resolveFindingCheckType,
  type FindingCheckMeta,
  type FindingCheckType,
} from "@/lib/check/check-type"
import type { DifyFindingItem } from "@/lib/dify/types"

export const FINDING_CHECK_TYPE_COLUMNS = [
  "check_type",
  "rule_code",
  "rule_version_id",
  "rule_title",
  "rule_version_no",
  "audit_item",
  "finding_check_as_of",
  "check_meta",
] as const

export function stripFindingCheckTypeColumns<T extends Record<string, unknown>>(
  row: T
): Omit<T, (typeof FINDING_CHECK_TYPE_COLUMNS)[number]> {
  const next = { ...row }
  for (const key of FINDING_CHECK_TYPE_COLUMNS) {
    delete next[key]
  }
  return next
}

export function isMissingCheckTypeColumnError(message: string): boolean {
  return FINDING_CHECK_TYPE_COLUMNS.some((col) => message.includes(col))
}

export function buildFindingCheckFields(
  item: DifyFindingItem,
  opts: { isAlignment: boolean; checkAsOf: string }
): {
  check_type: FindingCheckType | null
  rule_code: string | null
  rule_version_id: string | null
  rule_title: string | null
  rule_version_no: number | null
  audit_item: string | null
  finding_check_as_of: string | null
  check_meta: FindingCheckMeta
  basis: string | null
} {
  const checkType = resolveFindingCheckType({
    explicit: item.checkType,
    isAlignment: opts.isAlignment,
    ruleCode: item.ruleCode,
    ruleVersionId: item.ruleVersionId,
  })
  const comparison = item.comparison ?? []
  const comparisonText = formatComparisonText(comparison)
  const basis =
    checkType === "consistency"
      ? comparisonText ?? item.basis?.slice(0, 1000) ?? null
      : item.basis?.slice(0, 1000) ?? comparisonText ?? null

  return {
    check_type: checkType,
    rule_code: item.ruleCode?.trim() || null,
    rule_version_id: item.ruleVersionId?.trim() || null,
    rule_title: item.ruleTitle?.trim() || null,
    rule_version_no:
      typeof item.ruleVersionNo === "number" && Number.isFinite(item.ruleVersionNo)
        ? item.ruleVersionNo
        : null,
    audit_item: item.auditItem?.trim() || null,
    finding_check_as_of:
      item.checkAsOf?.trim() || (checkType === "rule" ? opts.checkAsOf : null),
    check_meta: {
      schemaVersion: 1,
      ...(comparison.length > 0 ? { comparison } : {}),
    },
    basis,
  }
}
