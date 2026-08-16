import { describe, expect, it } from "vitest"
import {
  extractPlanDateAlignment,
  findPlanDateAlignmentFinding,
  isSimilarPlanDateFinding,
  mergeFindingsWithPlanDateAlignment,
  parseLabeledDate,
  withBuiltinPlanDateAlignmentRule,
} from "@/lib/check/plan-date-alignment"
import type { ResolvedCheckRule } from "@/lib/rule-engine/resolve-check-rules"

function stubRule(code: string): ResolvedCheckRule {
  return {
    versionId: `v-${code}`,
    ruleId: `r-${code}`,
    code,
    title: code,
    versionNo: 1,
    guidanceText: "観点です。",
    severity: "mid",
    effectiveFrom: "2026-04-01",
    effectiveTo: null,
    auditItemTitle: null,
    sourceTitle: null,
  }
}

describe("parseLabeledDate", () => {
  it("和暦・西暦・全角を YYYY-MM-DD にする", () => {
    expect(parseLabeledDate("令和8年4月1日")).toBe("2026-04-01")
    expect(parseLabeledDate("令和元年12月31日")).toBe("2019-12-31")
    expect(parseLabeledDate("令和８年４月１日")).toBe("2026-04-01")
    expect(parseLabeledDate("2026年1月10日")).toBe("2026-01-10")
    expect(parseLabeledDate("2026-01-10")).toBe("2026-01-10")
  })
})

describe("extractPlanDateAlignment", () => {
  it("ケアプラン更新より計画書が古いときに両方の日付を返す", () => {
    const text = `
      居宅サービス計画（ケアプラン）更新日：令和8年4月1日
      訪問介護計画書 作成日：令和8年1月10日
    `
    expect(extractPlanDateAlignment(text)).toEqual({
      carePlanUpdateOn: "2026-04-01",
      visitPlanOn: "2026-01-10",
    })
  })

  it("計画が追いついていれば比較結果は出せるが指摘は出さない", () => {
    const text = `
      ケアプラン更新日 令和8年4月1日
      訪問介護計画 更新日 令和8年4月15日
    `
    expect(extractPlanDateAlignment(text)).toEqual({
      carePlanUpdateOn: "2026-04-01",
      visitPlanOn: "2026-04-15",
    })
    expect(findPlanDateAlignmentFinding(text)).toBeNull()
  })

  it("片方しか無いときは未検証（null）", () => {
    expect(
      extractPlanDateAlignment("訪問介護計画書 作成日：令和8年1月10日")
    ).toBeNull()
    expect(
      extractPlanDateAlignment("ケアプラン更新日：令和8年4月1日")
    ).toBeNull()
    expect(findPlanDateAlignmentFinding("")).toBeNull()
  })

  it("同じ日付なら指摘しない", () => {
    const text = `
      ケアプラン変更日：2026年4月1日
      訪問介護計画書作成日：2026年4月1日
    `
    expect(findPlanDateAlignmentFinding(text)).toBeNull()
  })

  it("本文が別でも日付を足して比べる", () => {
    expect(
      extractPlanDateAlignment([
        "ケアプラン更新日：令和8年4月1日",
        "訪問介護計画書 作成日：令和8年1月10日",
      ])
    ).toEqual({
      carePlanUpdateOn: "2026-04-01",
      visitPlanOn: "2026-01-10",
    })
  })

  it("追いついていないときは可能性の指摘を返す", () => {
    const finding = findPlanDateAlignmentFinding(`
      ケアプラン更新日：令和8年4月1日
      訪問介護計画書 作成日：令和7年12月1日
    `)
    expect(finding?.severity).toBe("mid")
    expect(finding?.title).toContain("追いついていない可能性")
    expect(finding?.description).toContain("2026年4月1日")
    expect(finding?.description).toContain("2025年12月1日")
    expect(finding?.description).not.toMatch(/不適合/)
  })
})

describe("withBuiltinPlanDateAlignmentRule", () => {
  it("先頭に標準観点を載せ、同コードは重複しない", () => {
    const merged = withBuiltinPlanDateAlignmentRule([
      stubRule("OTHER"),
      stubRule("HC_PLAN_UPDATED_DATE"),
    ])
    expect(merged[0]?.code).toBe("HC_PLAN_UPDATED_DATE")
    expect(merged.filter((r) => r.code === "HC_PLAN_UPDATED_DATE")).toHaveLength(
      1
    )
    expect(merged.map((r) => r.code)).toContain("OTHER")
  })
})

describe("isSimilarPlanDateFinding", () => {
  it("同じ観点のAI指摘を重複とみなす", () => {
    expect(
      isSimilarPlanDateFinding({
        title: "計画の更新日をご確認ください",
        description: "",
      })
    ).toBe(true)
  })
})

describe("mergeFindingsWithPlanDateAlignment", () => {
  it("機械指摘を先頭に置き、同じ観点のAI指摘は落とす", () => {
    const alignment = findPlanDateAlignmentFinding(`
      ケアプラン更新日：令和8年4月1日
      訪問介護計画書 作成日：令和7年12月1日
    `)
    expect(alignment).not.toBeNull()
    const merged = mergeFindingsWithPlanDateAlignment(
      [
        { title: "同意欄をご確認ください", description: "日付が空欄の可能性があります。" },
        {
          title: "計画の更新日をご確認ください",
          description: "追いついていない可能性があります。",
        },
      ],
      alignment
    )
    expect(merged[0]?.title).toBe(alignment?.title)
    expect(merged).toHaveLength(2)
  })
})
