import { describe, expect, it } from "vitest"
import {
  extractConsentDateAlignment,
  findConsentDateAlignmentFinding,
} from "@/lib/check/consent-date-alignment"

describe("extractConsentDateAlignment", () => {
  it("同意日と開始日を取り出す", () => {
    expect(
      extractConsentDateAlignment([
        "重要事項説明 同意日：令和8年5月10日",
        "サービス開始日：令和8年5月1日",
      ])
    ).toEqual({
      consentOn: "2026-05-10",
      startOn: "2026-05-01",
    })
  })
})

describe("findConsentDateAlignmentFinding", () => {
  it("同意が開始より後なら指摘する", () => {
    const finding = findConsentDateAlignmentFinding([
      "利用者同意日：2026年6月1日",
      "利用開始日：2026年5月20日",
    ])
    expect(finding?.title).toContain("同意日がサービス開始より後")
    expect(finding?.checkType).toBe("consistency")
  })

  it("同意が開始以前なら指摘しない", () => {
    expect(
      findConsentDateAlignmentFinding([
        "同意日：2026年5月1日",
        "サービス開始日：2026年5月10日",
      ])
    ).toBeNull()
  })
})
