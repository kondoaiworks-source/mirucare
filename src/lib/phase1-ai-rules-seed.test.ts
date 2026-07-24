import { describe, expect, it } from "vitest"
import { PHASE1_RULE_CODE_ALLOWLIST } from "@/lib/phase1-audit"
import {
  missingAllowlistCodesInSeeds,
  phase1SeedCodes,
} from "@/lib/phase1-ai-rules-seed"

describe("phase1 AI rule seeds", () => {
  it("allowlist の全 code をシード定義でカバーする", () => {
    expect(missingAllowlistCodesInSeeds()).toEqual([])
  })

  it("シード code は重複しない", () => {
    const codes = phase1SeedCodes()
    expect(new Set(codes).size).toBe(codes.length)
  })

  it("allowlist とシード件数が一致する（重複除く）", () => {
    expect(phase1SeedCodes().length).toBe(
      new Set(PHASE1_RULE_CODE_ALLOWLIST).size
    )
  })
})
