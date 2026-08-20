/**
 * 同一日の提供時間帯が重なっている可能性を機械的に拾う（セット本文）。
 */

import type { DifyFindingItem } from "@/lib/dify/types"
import {
  formatIsoDateJa,
  formatMinutesJa,
  intervalsOverlap,
  joinTexts,
  nearestDateBefore,
  parseTimeToMinutes,
  TIME_RANGE_RE,
} from "@/lib/check/alignment-shared"

export const SERVICE_TIME_OVERLAP_CODE = "HC_SERVICE_TIME_OVERLAP"
export const SERVICE_TIME_OVERLAP_VERSION_ID = `builtin:${SERVICE_TIME_OVERLAP_CODE}`

export type ServiceInterval = {
  date: string
  startMin: number
  endMin: number
  label: string
}

export function extractServiceIntervals(
  text: string | string[] | null | undefined
): ServiceInterval[] {
  const src = joinTexts(text)
  if (!src) return []

  const out: ServiceInterval[] = []
  const re = new RegExp(TIME_RANGE_RE.source, "g")
  let match: RegExpExecArray | null

  while ((match = re.exec(src))) {
    const startMin = parseTimeToMinutes(match[1] ?? "", match[2] ?? "0")
    const endMin = parseTimeToMinutes(match[3] ?? "", match[4] ?? "0")
    if (startMin == null || endMin == null || endMin <= startMin) continue

    const date = nearestDateBefore(src, match.index)
    if (!date) continue

    out.push({
      date,
      startMin,
      endMin,
      label: `${formatIsoDateJa(date)} ${formatMinutesJa(startMin)}～${formatMinutesJa(endMin)}`,
    })
  }

  return out
}

export function findServiceTimeOverlap(
  text: string | string[] | null | undefined
): { a: ServiceInterval; b: ServiceInterval } | null {
  const intervals = extractServiceIntervals(text)
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i]
      const b = intervals[j]
      if (!a || !b) continue
      if (a.date !== b.date) continue
      if (!intervalsOverlap(a.startMin, a.endMin, b.startMin, b.endMin)) {
        continue
      }
      return { a, b }
    }
  }
  return null
}

export function findServiceTimeOverlapFinding(
  text: string | string[] | null | undefined
): DifyFindingItem | null {
  const hit = findServiceTimeOverlap(text)
  if (!hit) return null

  return {
    severity: "high",
    title: "同一日の提供時間帯が重なっている可能性があります",
    description: `読み取れた範囲では、同じ日に「${hit.a.label}」と「${hit.b.label}」の時間帯が重なっています。記録の重複や転記誤りなどの可能性があります。ご確認ください。`,
    basis: "書類同士の時間整合（提供時間帯の重複）",
    suggestion:
      "提供記録・日報の開始・終了時刻を見比べ、重複がないかご確認ください。最終判断・提出は貴施設の責任で行ってください。",
    checkType: "consistency",
    comparison: [
      { source: "提供記録（時間帯A）", detail: hit.a.label },
      { source: "提供記録（時間帯B）", detail: hit.b.label },
    ],
  }
}

export function isSimilarServiceTimeOverlapFinding(item: {
  title?: string | null
  description?: string | null
}): boolean {
  const blob = `${item.title ?? ""}\n${item.description ?? ""}`
  return /提供時間帯が重なって|同一日の提供時間|同一時間帯の.*重複/.test(blob)
}
