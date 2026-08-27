import { describe, expect, it } from "vitest"
import { ALIGNMENT_CATALOG } from "@/lib/check/alignment-catalog"
import {
  buildCheckRunSummary,
  countRulebookRulesFromSnapshot,
} from "@/lib/check/check-run-summary"
import type { AppliedRulesSnapshot } from "@/types/database"

function snapshot(
  rules: Array<{ code: string }>,
  extra?: Partial<AppliedRulesSnapshot>
): AppliedRulesSnapshot {
  return {
    asOf: "2026-08-21",
    ruleCount: rules.length,
    truncated: false,
    rules: rules.map((r) => ({
      versionId: `v-${r.code}`,
      code: r.code,
      title: r.code,
      versionNo: 1,
      severity: "mid",
      effectiveFrom: "2026-04-01",
      effectiveTo: null,
      auditItemTitle: null,
      sourceTitle: null,
    })),
    regulatoryBasis: [],
    ...extra,
  }
}

describe("countRulebookRulesFromSnapshot", () => {
  it("returns null when there is no snapshot", () => {
    expect(countRulebookRulesFromSnapshot(null)).toBeNull()
    expect(countRulebookRulesFromSnapshot(undefined)).toBeNull()
  })

  it("excludes builtin alignment rules from the rulebook count", () => {
    expect(
      countRulebookRulesFromSnapshot(
        snapshot([
          { code: "HC_PLAN_UPDATED_DATE" },
          { code: "HC_CONSENT_DATE" },
          { code: "YOKOHAMA_ACCIDENT" },
        ])
      )
    ).toBe(2)
  })

  it("is 0 when only alignment builtins were passed", () => {
    expect(
      countRulebookRulesFromSnapshot(snapshot([{ code: "HC_PLAN_UPDATED_DATE" }]))
    ).toBe(0)
  })
})

describe("buildCheckRunSummary", () => {
  it("splits consistency findings from rulebook findings", () => {
    const summary = buildCheckRunSummary({
      findings: [
        { check_type: "consistency" },
        { check_type: "consistency" },
        { check_type: "rule", rule_code: "HC_CONSENT_DATE" },
        { source_kind: "ai" },
      ],
      snapshot: snapshot([
        { code: "HC_PLAN_UPDATED_DATE" },
        { code: "HC_CONSENT_DATE" },
      ]),
    })
    expect(summary.consistencyCheckedCount).toBe(ALIGNMENT_CATALOG.length)
    expect(summary.consistencyFindingCount).toBe(2)
    expect(summary.rulebookRuleCount).toBe(1)
    expect(summary.ruleFindingCount).toBe(1)
    expect(summary.unsetFindingCount).toBe(1)
    expect(summary.snapshotMissing).toBe(false)
    expect(summary.truncated).toBe(false)
  })

  it("keeps rule count unknown when the snapshot is missing", () => {
    const summary = buildCheckRunSummary({
      findings: [{ check_type: "rule", rule_code: "HC_01" }],
    })
    expect(summary.rulebookRuleCount).toBeNull()
    expect(summary.snapshotMissing).toBe(true)
    expect(summary.ruleFindingCount).toBe(1)
  })

  it("records truncation so the UI can warn about the 60-rule cap", () => {
    const summary = buildCheckRunSummary({
      findings: [],
      snapshot: snapshot([{ code: "HC_01" }], { truncated: true }),
    })
    expect(summary.truncated).toBe(true)
    expect(summary.rulebookRuleCount).toBe(1)
  })
})
