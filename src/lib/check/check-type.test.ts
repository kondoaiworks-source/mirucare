import { describe, expect, it } from "vitest"
import {
  countFindingsByCheckType,
  displayFindingCheckType,
  filterFindingsByCheckType,
  formatComparisonText,
  parseFindingCheckType,
  resolveFindingCheckType,
} from "@/lib/check/check-type"
import { parseDifyFindings } from "@/lib/dify/parse"

describe("parseFindingCheckType", () => {
  it("許可値だけを採用する", () => {
    expect(parseFindingCheckType("consistency")).toBe("consistency")
    expect(parseFindingCheckType("rule")).toBe("rule")
    expect(parseFindingCheckType("violation")).toBeUndefined()
    expect(parseFindingCheckType("")).toBeUndefined()
  })
})

describe("resolveFindingCheckType", () => {
  it("書類同士カタログは consistency", () => {
    expect(
      resolveFindingCheckType({ isAlignment: true, explicit: "rule" })
    ).toBe("consistency")
  })

  it("rule_code があるときだけ rule と推定する", () => {
    expect(resolveFindingCheckType({ ruleCode: "HC_01" })).toBe("rule")
    expect(resolveFindingCheckType({})).toBeNull()
    expect(resolveFindingCheckType({ explicit: "consistency" })).toBe(
      "consistency"
    )
  })
})

describe("displayFindingCheckType の旧データ互換", () => {
  it("check_type が無くても alignment は整合性", () => {
    expect(
      displayFindingCheckType({ source_kind: "alignment" })
    ).toBe("consistency")
  })

  it("判断できない旧AI指摘は未設定", () => {
    expect(displayFindingCheckType({ source_kind: "ai" })).toBeNull()
  })
})

describe("count / filter", () => {
  const rows = [
    { check_type: "consistency" as const },
    { check_type: "rule" as const, rule_code: "HC_01" },
    { check_type: null, source_kind: "ai" as const },
  ]

  it("件数を分類する", () => {
    expect(countFindingsByCheckType(rows)).toEqual({
      all: 3,
      consistency: 1,
      rule: 1,
      unset: 1,
    })
  })

  it("フィルターは該当分類のみ", () => {
    expect(filterFindingsByCheckType(rows, "all")).toHaveLength(3)
    expect(filterFindingsByCheckType(rows, "consistency")).toHaveLength(1)
    expect(filterFindingsByCheckType(rows, "rule")).toHaveLength(1)
    expect(filterFindingsByCheckType(rows, "unset")).toHaveLength(1)
  })
})

describe("Dify findings の check_type パース", () => {
  it("ケース1: 同一時間帯の重複は consistency", () => {
    const parsed = parseDifyFindings(
      JSON.stringify({
        findings: [
          {
            check_type: "consistency",
            severity: "high",
            title: "同一時間帯のサービス重複",
            description:
              "同じ担当者の提供時間が重なっている可能性があります。ご確認ください。",
            comparison: [
              { source: "サービス提供記録", detail: "2026/08/01 13:00～14:00" },
              { source: "サービス提供記録", detail: "2026/08/01 13:30～14:30" },
            ],
          },
        ],
      })
    )
    expect(parsed.parseOk).toBe(true)
    expect(parsed.findings[0]?.checkType).toBe("consistency")
    expect(parsed.findings[0]?.ruleCode).toBeUndefined()
    expect(parsed.findings[0]?.basis).toContain("サービス提供記録")
    expect(parsed.findings[0]?.description).not.toMatch(/違反です/)
  })

  it("ケース2: 提供記録と日報の時間不一致は consistency", () => {
    const parsed = parseDifyFindings(
      JSON.stringify({
        findings: [
          {
            check_type: "consistency",
            title: "提供時間の不一致",
            description: "サービス提供記録と日報の時間がずれている可能性があります。",
            comparison: [
              { source: "サービス提供記録", detail: "2026/08/01 13:00～14:00" },
              { source: "日報", detail: "2026/08/01 13:30～14:30" },
            ],
          },
        ],
      })
    )
    expect(parsed.findings[0]?.checkType).toBe("consistency")
    expect(formatComparisonText(parsed.findings[0]?.comparison)).toContain("日報")
  })

  it("ケース3: 日報のみの訪問は比較なら consistency、ルール根拠なら rule", () => {
    const consistency = parseDifyFindings(
      JSON.stringify({
        findings: [
          {
            check_type: "consistency",
            title: "日報にのみ存在する訪問",
            description: "日報にある訪問が提供記録に見当たらない可能性があります。",
          },
        ],
      })
    )
    expect(consistency.findings[0]?.checkType).toBe("consistency")

    const rule = parseDifyFindings(
      JSON.stringify({
        findings: [
          {
            check_type: "rule",
            rule_code: "HC_RECORD_REQUIRED",
            rule_version_id: "ver-1",
            rule_title: "サービス提供記録の作成",
            title: "サービス提供記録が必要です",
            description:
              "適用ルール上、サービス提供記録の作成が必要な可能性があります。ご確認ください。",
          },
        ],
      })
    )
    expect(rule.findings[0]?.checkType).toBe("rule")
    expect(rule.findings[0]?.ruleCode).toBe("HC_RECORD_REQUIRED")
    expect(rule.findings[0]?.ruleVersionId).toBe("ver-1")
  })

  it("ケース4: 必須項目の空欄は rule とコード付き", () => {
    const parsed = parseDifyFindings(
      JSON.stringify({
        findings: [
          {
            check_type: "rule",
            rule_code: "HC_RECORD_USER_CONFIRMATION",
            rule_version_id: "uuid-rule-ver",
            rule_title: "利用者確認記録",
            audit_item: "サービス提供記録",
            check_as_of: "2026-08-18",
            title: "利用者確認記録の不足",
            description: "必須とされている確認欄が空欄の可能性があります。ご確認ください。",
          },
        ],
      })
    )
    expect(parsed.findings[0]?.checkType).toBe("rule")
    expect(parsed.findings[0]?.ruleCode).toBe("HC_RECORD_USER_CONFIRMATION")
    expect(parsed.findings[0]?.ruleVersionId).toBe("uuid-rule-ver")
    expect(parsed.findings[0]?.auditItem).toBe("サービス提供記録")
  })

  it("check_type が無いJSONでもパースできる（旧形式）", () => {
    const parsed = parseDifyFindings(
      JSON.stringify({
        findings: [{ title: "旧形式の指摘", description: "ご確認ください。" }],
      })
    )
    expect(parsed.parseOk).toBe(true)
    expect(parsed.findings[0]?.checkType).toBeUndefined()
    expect(displayFindingCheckType({ check_type: parsed.findings[0]?.checkType })).toBeNull()
  })
})
