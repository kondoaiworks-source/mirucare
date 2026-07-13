import type {
  Attendance,
  AttendanceContradiction,
  ServiceRecord,
} from "@/types/database"

export type ServiceRecordWithHelper = ServiceRecord & {
  helper_name: string
}

export type AttendanceWithHelper = Attendance & {
  helper_name: string
}

function toMs(iso: string): number {
  return new Date(iso).getTime()
}

function formatHm(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

/** 時間帯が重なるか（開始＝終了の接触は重複とみなさない） */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return toMs(aStart) < toMs(bEnd) && toMs(bStart) < toMs(aEnd)
}

/**
 * 勤怠の矛盾検知
 * A: 同一ヘルパー・同一日のサービス提供記録の時間重複
 * B: タイムカード退勤より日報終了が後
 */
export function detectAttendanceContradictions(
  records: ServiceRecordWithHelper[],
  attendances: AttendanceWithHelper[]
): AttendanceContradiction[] {
  const results: AttendanceContradiction[] = []
  const seenOverlapKeys = new Set<string>()

  const byHelperDate = new Map<string, ServiceRecordWithHelper[]>()
  for (const rec of records) {
    const key = `${rec.helper_id}|${rec.service_date}`
    const list = byHelperDate.get(key) ?? []
    list.push(rec)
    byHelperDate.set(key, list)
  }

  for (const group of Array.from(byHelperDate.values())) {
    const sorted = [...group].sort(
      (a, b) => toMs(a.start_at) - toMs(b.start_at)
    )
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]
        const b = sorted[j]
        if (!rangesOverlap(a.start_at, a.end_at, b.start_at, b.end_at)) {
          continue
        }
        const pairKey = [a.id, b.id].sort().join(":")
        if (seenOverlapKeys.has(pairKey)) continue
        seenOverlapKeys.add(pairKey)

        results.push({
          helper_id: a.helper_id,
          helper_name: a.helper_name,
          date: a.service_date,
          error_type: "OVERLAP",
          message: `同じ時間帯に複数のサービス提供記録がある可能性があります（${formatHm(a.start_at)}〜${formatHm(a.end_at)} と ${formatHm(b.start_at)}〜${formatHm(b.end_at)}）。ご確認ください。`,
        })
      }
    }
  }

  const attendanceMap = new Map<string, AttendanceWithHelper>()
  for (const att of attendances) {
    attendanceMap.set(`${att.helper_id}|${att.work_date}`, att)
  }

  for (const rec of records) {
    const att = attendanceMap.get(`${rec.helper_id}|${rec.service_date}`)
    if (!att) continue
    if (toMs(rec.end_at) <= toMs(att.clock_out_at)) continue

    results.push({
      helper_id: rec.helper_id,
      helper_name: rec.helper_name,
      date: rec.service_date,
      error_type: "TIME_DISCREPANCY",
      message: `タイムカード退勤（${formatHm(att.clock_out_at)}）より、サービス提供記録の終了（${formatHm(rec.end_at)}）が後になっている可能性があります。ご確認ください。`,
    })
  }

  return results.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.helper_name !== b.helper_name) {
      return a.helper_name.localeCompare(b.helper_name, "ja")
    }
    return a.error_type.localeCompare(b.error_type)
  })
}
