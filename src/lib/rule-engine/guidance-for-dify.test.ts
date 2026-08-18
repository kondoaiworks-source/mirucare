import { describe, expect, it } from "vitest"
import {
  APPROVED_RULES_JSON_MAX_CHARS,
  extractPriorityGuidance,
  GUIDANCE_MAX_CHARS,
  GUIDANCE_MIN_CHARS,
  perRuleGuidanceBudget,
} from "@/lib/rule-engine/guidance-for-dify"
import {
  buildSerializedRulesPayload,
  serializeRulesForDify,
  toAppliedRulesSnapshot,
  type CheckRulesResolution,
  type ResolvedCheckRule,
} from "@/lib/rule-engine/resolve-check-rules"

function stubRule(
  code: string,
  guidanceText: string,
  extra?: Partial<ResolvedCheckRule>
): ResolvedCheckRule {
  return {
    versionId: `v-${code}`,
    ruleId: `r-${code}`,
    code,
    title: `ルール ${code}`,
    versionNo: 1,
    guidanceText,
    severity: "mid",
    effectiveFrom: "2026-04-01",
    effectiveTo: null,
    auditItemTitle: "記録",
    sourceTitle: null,
    ...extra,
  }
}

describe("extractPriorityGuidance", () => {
  it("予算400でもキーワード箇所は残す（先頭sliceでは落ちる）", () => {
    const marker = "例外条件：加算は算定対象外となり、返戻となる場合があります。"
    const src = `${"あ".repeat(401)}${marker}`
    expect(src.slice(0, 400)).not.toContain("算定対象外")
    const result = extractPriorityGuidance(src, 400)
    expect(result.truncated).toBe(true)
    expect(result.text).toContain("算定対象外")
    expect(result.text).toContain("返戻")
  })

  it("401文字目以降の算定・例外条件を残す", () => {
    const marker = "例外条件：加算は算定対象外となり、返戻となる場合があります。"
    const src = `${"あ".repeat(900)}${marker}${"い".repeat(400)}`
    expect(src.length).toBeGreaterThan(1000)
    const result = extractPriorityGuidance(src, 1000)
    expect(result.truncated).toBe(true)
    expect(result.text).toContain("例外条件")
    expect(result.text).toContain("算定対象外")
    expect(result.text).toContain("返戻")
    expect(result.text.length).toBeLessThanOrEqual(1000)
  })
})

describe("perRuleGuidanceBudget", () => {
  it("1件なら上限付近まで使える", () => {
    expect(perRuleGuidanceBudget(1)).toBe(GUIDANCE_MAX_CHARS)
  })

  it("件数が多いときは下限以上・全体予算内", () => {
    const n = 40
    const budget = perRuleGuidanceBudget(n)
    expect(budget).toBeGreaterThanOrEqual(GUIDANCE_MIN_CHARS)
    expect(budget).toBeLessThanOrEqual(GUIDANCE_MAX_CHARS)
    expect(n * budget).toBeLessThan(APPROVED_RULES_JSON_MAX_CHARS)
  })
})

describe("serializeRulesForDify の文字数", () => {
  it("400文字超の重要条件がJSONに残る（先頭400切り捨てではない）", () => {
    const marker = "【401文字目以降の算定要件】返戻となる場合があります。"
    const guidance = `${"前半の説明です。".repeat(80)}${marker}`
    expect(guidance.length).toBeGreaterThan(400)
    const json = serializeRulesForDify([stubRule("HC_LONG_01", guidance)])
    expect(json).toContain("401文字目以降の算定要件")
    expect(json).toContain("返戻")
    const parsed = JSON.parse(json) as Array<{ guidance: string }>
    expect(parsed[0]?.guidance.length).toBeGreaterThan(400)
  })

  it("多数の長文ルールでも 60,000 文字以内の妥当なJSON", () => {
    const long = `${"必須事項。".repeat(80)}例外条件：請求対象外です。${"後半。".repeat(80)}`
    const rules = Array.from({ length: 40 }, (_, i) =>
      stubRule(`HC_${String(i).padStart(2, "0")}`, long)
    )
    const payload = buildSerializedRulesPayload(rules)
    expect(payload.approvedRulesJsonLength).toBeLessThanOrEqual(
      APPROVED_RULES_JSON_MAX_CHARS
    )
    const parsed = JSON.parse(payload.json) as unknown
    expect(Array.isArray(parsed)).toBe(true)
    expect((parsed as unknown[]).length).toBe(40)
    expect(payload.json).toContain("請求対象外")
  })

  it("スナップショットに guidanceHash と渡した本文を残す", () => {
    const guidance = "記録要件を満たしているかご確認ください。"
    const rules = [stubRule("HC_SNAP_01", guidance)]
    const sent = buildSerializedRulesPayload(rules)
    const sample: CheckRulesResolution = {
      asOf: "2026-08-18",
      truncated: false,
      rules,
      regulatoryBasis: [],
    }
    const snap = toAppliedRulesSnapshot(sample, sent)
    expect(snap.rules[0]?.guidanceSent).toBe(guidance)
    expect(snap.rules[0]?.guidanceLength).toBe(guidance.length)
    expect(snap.rules[0]?.guidanceTruncated).toBe(false)
    expect(snap.rules[0]?.guidanceHash).toMatch(/^[a-f0-9]{24}$/)
    expect(snap.approvedRulesJsonLength).toBe(sent.approvedRulesJsonLength)
  })
})
