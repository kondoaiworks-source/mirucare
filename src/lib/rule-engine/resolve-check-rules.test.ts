import { describe, expect, it } from "vitest"
import {
  serializeRegulatoryBasisForDify,
  serializeRulesForDify,
  toAppliedRulesSnapshot,
  type CheckRulesResolution,
} from "@/lib/rule-engine/resolve-check-rules"

describe("resolve-check-rules serializers", () => {
  const sample: CheckRulesResolution = {
    asOf: "2026-07-22",
    truncated: false,
    rules: [
      {
        versionId: "v1",
        ruleId: "r1",
        code: "HC_PLAN_01",
        title: "計画と実態の整合",
        versionNo: 2,
        guidanceText: "計画外サービスに読める記載がないかご確認ください。",
        severity: "high",
        effectiveFrom: "2026-04-01",
        effectiveTo: null,
        auditItemTitle: "訪問介護計画",
        sourceTitle: null,
      },
    ],
    regulatoryBasis: [
      {
        id: "k1",
        title: "集団指導資料",
        year: 2026,
        regionName: "横浜市",
        jurisdictionLevel: "municipality",
      },
    ],
  }

  it("Dify向けJSONにコードと版を含める", () => {
    const json = serializeRulesForDify(sample.rules)
    expect(json).toContain("HC_PLAN_01")
    expect(json).toContain("version_no")
    expect(json).toContain("v1")
  })

  it("行政根拠JSONにタイトルを含める", () => {
    const json = serializeRegulatoryBasisForDify(sample.regulatoryBasis)
    expect(json).toContain("集団指導資料")
    expect(json).toContain("横浜市")
  })

  it("スナップショットに基準日と件数を残す", () => {
    const snap = toAppliedRulesSnapshot(sample)
    expect(snap.asOf).toBe("2026-07-22")
    expect(snap.ruleCount).toBe(1)
    expect(snap.rules[0]?.versionNo).toBe(2)
  })
})
