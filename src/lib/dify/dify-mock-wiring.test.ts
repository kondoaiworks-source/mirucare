/**
 * Dify モック配線のスモークテスト（success / parse_error / empty）
 *
 * runMockDifyCheck は src/lib/dify/mock.ts。
 * parse_error は例外を投げず、parseOk=false + usedFallback=true + フォールバック1件を返す。
 */
import { describe, expect, it } from "vitest"
import { runMockDifyCheck } from "@/lib/dify/mock"
import { CHECK_UI } from "@/lib/copy/check-ui"
import type { DifyCheckInput } from "@/lib/dify/types"

const baseInput: Omit<DifyCheckInput, "mockScenario"> = {
  municipality: "渋谷区",
  prefecture: "東京都",
  national: "0",
  docType: "提供記録",
}

describe("Dify モック配線 (runMockDifyCheck)", () => {
  it("success: parseOk かつ rule / consistency の指摘を返す", async () => {
    const result = await runMockDifyCheck({
      ...baseInput,
      mockScenario: "success",
    })

    expect(result.parseOk).toBe(true)
    expect(result.usedFallback).toBe(false)
    expect(result.findings.length).toBeGreaterThanOrEqual(2)
    expect(result.findings.some((f) => f.checkType === "consistency")).toBe(
      true
    )
    expect(
      result.findings.some((f) => f.checkType === "rule" && Boolean(f.ruleCode))
    ).toBe(true)
  })

  it("parse_error: 例外せずフォールバック指摘1件を返す", async () => {
    const result = await runMockDifyCheck({
      ...baseInput,
      mockScenario: "parse_error",
    })

    expect(result.parseOk).toBe(false)
    expect(result.usedFallback).toBe(true)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.title).toBe(CHECK_UI.summaryFallback)
  })

  it("empty: 指摘0件を返す", async () => {
    const result = await runMockDifyCheck({
      ...baseInput,
      mockScenario: "empty",
    })

    expect(result.parseOk).toBe(true)
    expect(result.usedFallback).toBe(false)
    expect(result.findings).toHaveLength(0)
  })
})
