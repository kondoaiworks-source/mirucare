import { describe, expect, it } from "vitest"
import {
  isPhase1RuleCode,
  matchesPhase1RuleText,
  PHASE1_RULE_CODE_ALLOWLIST,
} from "@/lib/phase1-audit"

describe("phase1 rule scope", () => {
  it("allowlist の code を許可する", () => {
    expect(isPhase1RuleCode("HC_PLAN_CARE_PLAN_ALIGNMENT")).toBe(true)
    expect(isPhase1RuleCode("HC_BILLING_ACTUAL_RESULT_MATCH")).toBe(true)
    expect(isPhase1RuleCode("HC_BCP_INFECTION")).toBe(false)
  })

  it("code が無くてもキーワードで許可する", () => {
    expect(
      matchesPhase1RuleText(null, "ケアプランと計画書の整合", null)
    ).toBe(true)
    expect(matchesPhase1RuleText(null, "シフトと提供記録", null)).toBe(true)
    expect(matchesPhase1RuleText(null, "国保連請求の突合", null)).toBe(true)
    expect(matchesPhase1RuleText(null, "BCP訓練の記録", null)).toBe(false)
  })

  it("Phase1 allowlist に必須コードが含まれる", () => {
    expect(PHASE1_RULE_CODE_ALLOWLIST).toContain("HC_PLAN_CARE_PLAN_ALIGNMENT")
    expect(PHASE1_RULE_CODE_ALLOWLIST).toContain("HC_RECORD_SERVICE_CONTENT")
    expect(PHASE1_RULE_CODE_ALLOWLIST).toContain("HC_GOV_WORK_PATTERN_LIST")
    expect(PHASE1_RULE_CODE_ALLOWLIST).toContain(
      "HC_BILLING_SERVICE_RECORD_MATCH"
    )
  })
})
