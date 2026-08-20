import { describe, expect, it } from "vitest"
import {
  extractServiceIntervals,
  findServiceTimeOverlapFinding,
} from "@/lib/check/service-time-overlap"

describe("extractServiceIntervals", () => {
  it("日付付きの時間帯を取り出す", () => {
    const intervals = extractServiceIntervals(
      "サービス提供記録 2026年8月1日 13:00～14:00 訪問"
    )
    expect(intervals).toHaveLength(1)
    expect(intervals[0]?.date).toBe("2026-08-01")
    expect(intervals[0]?.startMin).toBe(13 * 60)
    expect(intervals[0]?.endMin).toBe(14 * 60)
  })
})

describe("findServiceTimeOverlapFinding", () => {
  it("同一日の重なりを指摘する", () => {
    const finding = findServiceTimeOverlapFinding([
      "提供記録 令和8年8月1日 13:00～14:00",
      "日報 令和8年8月1日 13:30～14:30",
    ])
    expect(finding?.title).toContain("重なっている可能性")
    expect(finding?.checkType).toBe("consistency")
    expect(finding?.comparison).toHaveLength(2)
  })

  it("日付が違う・重ならないときは指摘しない", () => {
    expect(
      findServiceTimeOverlapFinding([
        "提供記録 2026年8月1日 13:00～14:00",
        "提供記録 2026年8月1日 15:00～16:00",
      ])
    ).toBeNull()
    expect(
      findServiceTimeOverlapFinding([
        "提供記録 2026年8月1日 13:00～14:00",
        "提供記録 2026年8月2日 13:30～14:30",
      ])
    ).toBeNull()
  })
})
