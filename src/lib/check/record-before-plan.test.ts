import { describe, expect, it } from "vitest"
import {
  extractRecordBeforePlan,
  findRecordBeforePlanFinding,
} from "@/lib/check/record-before-plan"

describe("extractRecordBeforePlan", () => {
  it("計画作成と提供日を取り出す", () => {
    expect(
      extractRecordBeforePlan([
        "訪問介護計画書 作成日：令和8年4月1日",
        "サービス提供日：令和8年3月15日",
      ])
    ).toEqual({
      visitPlanOn: "2026-04-01",
      earliestServiceOn: "2026-03-15",
    })
  })
})

describe("findRecordBeforePlanFinding", () => {
  it("計画より前の提供日を指摘する", () => {
    const finding = findRecordBeforePlanFinding([
      "訪問介護計画 更新日：2026年4月1日",
      "サービス提供日：2026年3月20日",
    ])
    expect(finding?.title).toContain("計画の作成より前の提供日")
    expect(finding?.checkType).toBe("consistency")
  })

  it("提供が計画以降なら指摘しない", () => {
    expect(
      findRecordBeforePlanFinding([
        "訪問介護計画書 作成日：2026年4月1日",
        "実施日：2026年4月10日",
      ])
    ).toBeNull()
  })

  it("片方しか無いときは未検証", () => {
    expect(
      findRecordBeforePlanFinding("訪問介護計画書 作成日：2026年4月1日")
    ).toBeNull()
  })
})
