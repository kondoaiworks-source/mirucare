import { describe, expect, it } from "vitest"
import {
  detectAttendanceContradictions,
  rangesOverlap,
} from "@/lib/attendance/detect-contradictions"
import {
  extractBillingRowsFromMatrix,
  normalizeDate,
  normalizeHm,
  reconcileBillingWithRecords,
} from "@/lib/billing/reconcile"
import type { AttendanceWithHelper, ServiceRecordWithHelper } from "@/lib/attendance/detect-contradictions"

describe("rangesOverlap", () => {
  it("detects physical overlap", () => {
    expect(
      rangesOverlap(
        "2026-07-01T10:00:00+09:00",
        "2026-07-01T11:00:00+09:00",
        "2026-07-01T10:30:00+09:00",
        "2026-07-01T11:30:00+09:00"
      )
    ).toBe(true)
  })

  it("does not treat adjacent ranges as overlap", () => {
    expect(
      rangesOverlap(
        "2026-07-01T10:00:00+09:00",
        "2026-07-01T11:00:00+09:00",
        "2026-07-01T11:00:00+09:00",
        "2026-07-01T12:00:00+09:00"
      )
    ).toBe(false)
  })
})

describe("detectAttendanceContradictions", () => {
  const baseRecord = {
    organization_id: "org",
    client_label: "利用者A",
    created_at: "",
    updated_at: "",
    deleted_at: null,
  }

  it("flags OVERLAP for same helper same day", () => {
    const records: ServiceRecordWithHelper[] = [
      {
        ...baseRecord,
        id: "r1",
        helper_id: "h1",
        helper_name: "山田",
        service_date: "2026-07-01",
        start_at: "2026-07-01T10:00:00+09:00",
        end_at: "2026-07-01T11:00:00+09:00",
      },
      {
        ...baseRecord,
        id: "r2",
        helper_id: "h1",
        helper_name: "山田",
        service_date: "2026-07-01",
        start_at: "2026-07-01T10:45:00+09:00",
        end_at: "2026-07-01T11:30:00+09:00",
      },
    ]
    const result = detectAttendanceContradictions(records, [])
    expect(result).toHaveLength(1)
    expect(result[0].error_type).toBe("OVERLAP")
    expect(result[0].helper_id).toBe("h1")
  })

  it("flags TIME_DISCREPANCY when service ends after clock-out", () => {
    const records: ServiceRecordWithHelper[] = [
      {
        ...baseRecord,
        id: "r1",
        helper_id: "h1",
        helper_name: "山田",
        service_date: "2026-07-01",
        start_at: "2026-07-01T17:00:00+09:00",
        end_at: "2026-07-01T18:30:00+09:00",
      },
    ]
    const attendances: AttendanceWithHelper[] = [
      {
        id: "a1",
        organization_id: "org",
        helper_id: "h1",
        helper_name: "山田",
        work_date: "2026-07-01",
        clock_in_at: "2026-07-01T09:00:00+09:00",
        clock_out_at: "2026-07-01T18:00:00+09:00",
        created_at: "",
        updated_at: "",
        deleted_at: null,
      },
    ]
    const result = detectAttendanceContradictions(records, attendances)
    expect(result.some((r) => r.error_type === "TIME_DISCREPANCY")).toBe(true)
  })
})

describe("billing reconcile", () => {
  it("normalizes date and time", () => {
    expect(normalizeDate("2026/7/1")).toBe("2026-07-01")
    expect(normalizeHm("9:05")).toBe("09:05")
    expect(normalizeHm("0905")).toBe("09:05")
  })

  it("extracts rows from CSV matrix", () => {
    const { rows } = extractBillingRowsFromMatrix([
      ["利用者", "日付", "サービス提供時間"],
      ["佐藤", "2026-07-01", "10:00〜11:00"],
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].startHm).toBe("10:00")
    expect(rows[0].endHm).toBe("11:00")
  })

  it("marks exact / mismatch / missing", () => {
    const billing = extractBillingRowsFromMatrix([
      ["利用者", "日付", "開始", "終了"],
      ["佐藤", "2026-07-01", "10:00", "11:00"],
      ["鈴木", "2026-07-01", "10:05", "11:00"],
      ["田中", "2026-07-01", "12:00", "13:00"],
    ]).rows

    const records = [
      {
        id: "1",
        client_label: "佐藤",
        service_date: "2026-07-01",
        start_at: "2026-07-01T10:00:00+09:00",
        end_at: "2026-07-01T11:00:00+09:00",
      },
      {
        id: "2",
        client_label: "鈴木",
        service_date: "2026-07-01",
        start_at: "2026-07-01T10:00:00+09:00",
        end_at: "2026-07-01T11:00:00+09:00",
      },
    ]

    const result = reconcileBillingWithRecords(billing, records)
    expect(result[0].status).toBe("exact")
    expect(result[1].status).toBe("mismatch")
    expect(result[1].warning).toContain("請求: 10:05")
    expect(result[2].status).toBe("missing")
  })
})
