import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  SCENARIO_SECTION_HEADERS,
  buildScenarioDocumentTextFromJson,
  scenarioJsonToDocumentParts,
} from "./build-scenario-document-text"

const SCENARIO_06 = path.join(
  process.cwd(),
  "test-data/scenarios/テストケース_異常系06_同意なし変更.json"
)

describe("scenarioJsonToDocumentParts / ケアプラン_変更", () => {
  it("異常系_06: 変更日・変更内容・利用者同意・同意書を独立セクションに載せる", () => {
    const raw = JSON.parse(readFileSync(SCENARIO_06, "utf8")) as Record<
      string,
      unknown
    >
    const parts = scenarioJsonToDocumentParts(raw)

    expect(parts.carePlanChange).toContain("変更日: 2024-02-10")
    expect(parts.carePlanChange).toContain(
      "変更内容: サービス頻度を『週3回（月・水・木）』に増加"
    )
    expect(parts.carePlanChange).toContain("利用者同意: なし（★問題）")
    expect(parts.carePlanChange).toContain("同意書: なし（★問題）")

    const text = buildScenarioDocumentTextFromJson(raw)
    expect(text).toContain(SCENARIO_SECTION_HEADERS.carePlan)
    expect(text).toContain(SCENARIO_SECTION_HEADERS.carePlanChange)
    expect(text.indexOf(SCENARIO_SECTION_HEADERS.carePlan)).toBeLessThan(
      text.indexOf(SCENARIO_SECTION_HEADERS.carePlanChange)
    )
    expect(text.indexOf(SCENARIO_SECTION_HEADERS.carePlanChange)).toBeLessThan(
      text.indexOf(SCENARIO_SECTION_HEADERS.record)
    )
  })

  it("ケアプラン_変更が無いシナリオでは変更セクションを出さない", () => {
    const parts = scenarioJsonToDocumentParts({
      利用者情報: { 氏名: "山田太郎", 年齢: 84 },
      ケアプラン: {
        プランID: "PLAN-001",
        作成日: "2024-01-15",
        サービス内容: [],
      },
      サービス実績記録: { 記録ID: "REC-001", 実績データ: [] },
      請求データ: { 請求ID: "INV-001", 請求内訳: [] },
    })
    expect(parts.carePlanChange).toBe("")

    const text = buildScenarioDocumentTextFromJson({
      利用者情報: { 氏名: "山田太郎" },
      ケアプラン: { プランID: "PLAN-001" },
      サービス実績記録: { 記録ID: "REC-001", 実績データ: [] },
      請求データ: { 請求ID: "INV-001", 請求内訳: [] },
    })
    expect(text).not.toContain(SCENARIO_SECTION_HEADERS.carePlanChange)
  })
})
