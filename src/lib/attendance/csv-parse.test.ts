import { describe, expect, it } from "vitest"
import {
  detectImportKind,
  parseAttendanceImportMatrix,
  toTokyoIso,
} from "@/lib/attendance/csv-parse"

describe("attendance csv parse", () => {
  it("detects attendance kind", () => {
    expect(
      detectImportKind(["ヘルパー名", "日付", "出勤", "退勤"])
    ).toBe("attendance")
  })

  it("detects service_records kind", () => {
    expect(
      detectImportKind(["ヘルパー名", "利用者", "日付", "開始", "終了"])
    ).toBe("service_records")
  })

  it("parses timecard rows", () => {
    const result = parseAttendanceImportMatrix(
      [
        ["ヘルパー名", "職員コード", "日付", "出勤", "退勤"],
        ["山田", "H001", "2026/7/1", "9:00", "18:00"],
      ],
      { kind: "attendance" }
    )
    expect("error" in result).toBe(false)
    if ("error" in result) return
    expect(result.kind).toBe("attendance")
    if (result.kind !== "attendance") return
    expect(result.rows[0].clockInHm).toBe("09:00")
    expect(result.rows[0].workDate).toBe("2026-07-01")
  })

  it("parses service records with time range", () => {
    const result = parseAttendanceImportMatrix(
      [
        ["担当ヘルパー", "利用者氏名", "サービス年月日", "サービス提供時間"],
        ["山田", "佐藤", "2026-07-01", "10:00〜11:00"],
      ],
      { preset: "honobono" }
    )
    expect("error" in result).toBe(false)
    if ("error" in result) return
    expect(result.kind).toBe("service_records")
    if (result.kind !== "service_records") return
    expect(result.rows[0].startHm).toBe("10:00")
    expect(result.rows[0].endHm).toBe("11:00")
  })

  it("builds tokyo iso", () => {
    expect(toTokyoIso("2026-07-01", "09:05")).toBe(
      "2026-07-01T09:05:00+09:00"
    )
  })
})
