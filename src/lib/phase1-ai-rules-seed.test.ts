import { describe, expect, it } from "vitest"
import { PHASE1_RULE_CODE_ALLOWLIST } from "@/lib/phase1-audit"
import {
  FREQUENT_GUIDANCE_RULE_SEEDS,
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

  it("運営指導で見られやすい頻出観点を40件以上持つ", () => {
    expect(FREQUENT_GUIDANCE_RULE_SEEDS.length).toBeGreaterThanOrEqual(40)
    expect(phase1SeedCodes().length).toBeGreaterThan(
      new Set(PHASE1_RULE_CODE_ALLOWLIST).size
    )
  })
})
