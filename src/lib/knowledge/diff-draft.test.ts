import { describe, expect, it } from "vitest"
import {
  quoteExistsInSource,
  verifyChangeQuotes,
  type KnowledgeChangeItem,
} from "./diff-draft"

describe("quoteExistsInSource", () => {
  it("空白差を無視して一致判定する", () => {
    expect(quoteExistsInSource("あ い", "あいうえ")).toBe(true)
  })

  it("原文に無い引用は不一致", () => {
    expect(quoteExistsInSource("捏造", "あいうえ")).toBe(false)
  })

  it("空引用は対象外扱い（true）", () => {
    expect(quoteExistsInSource("  ", "あいうえ")).toBe(true)
  })
})

describe("verifyChangeQuotes", () => {
  it("一致率を計算し要精査を判定する", () => {
    const changes: KnowledgeChangeItem[] = [
      {
        change_type: "改正",
        before_text: "旧",
        after_text: "新",
        quote_before: "旧規定",
        quote_after: "新規定",
        confidence: "high",
      },
      {
        change_type: "追加",
        before_text: "",
        after_text: "追記",
        quote_before: "",
        quote_after: "存在しない引用",
        confidence: "low",
      },
    ]
    const out = verifyChangeQuotes(
      changes,
      "ここに旧規定があります",
      "ここに新規定があります"
    )
    // quote_before ok, quote_after ok, 2nd quote_after ng → 2/3
    expect(out.quoteVerifiedRatio).toBeCloseTo(2 / 3, 3)
    expect(out.needsReview).toBe(true)
    expect(out.changes[0]?.quote_before_verified).toBe(true)
    expect(out.changes[0]?.quote_after_verified).toBe(true)
    expect(out.changes[1]?.quote_after_verified).toBe(false)
  })

  it("引用が全て空なら ratio=1", () => {
    const out = verifyChangeQuotes(
      [
        {
          change_type: "改正",
          before_text: "a",
          after_text: "b",
          quote_before: "",
          quote_after: "",
          confidence: "medium",
        },
      ],
      "a",
      "b"
    )
    expect(out.quoteVerifiedRatio).toBe(1)
    expect(out.needsReview).toBe(false)
  })
})
