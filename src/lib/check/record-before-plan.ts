/**
 * 訪問介護計画の作成より前の提供日がある可能性を機械的に拾う。
 */

import type { DifyFindingItem } from "@/lib/dify/types"
import {
  DATE_TOKEN_RE,
  formatIsoDateJa,
  joinTexts,
  lastIndexOfAny,
  parseLabeledDate,
} from "@/lib/check/alignment-shared"

export const RECORD_BEFORE_PLAN_CODE = "HC_RECORD_BEFORE_PLAN"
export const RECORD_BEFORE_PLAN_VERSION_ID = `builtin:${RECORD_BEFORE_PLAN_CODE}`

const CONTEXT_CHARS = 96
const VISIT_PLAN_MARKERS = ["訪問介護計画"]
const SERVICE_DATE_MARKERS = [
  "サービス提供日",
  "提供日",
  "実施日",
  "訪問日",
  "サービス実施",
]

export type RecordBeforePlanHit = {
  visitPlanOn: string
  earliestServiceOn: string
}

function classifyDateContext(
  before: string
): "visit_plan" | "service" | null {
  const visitPos = lastIndexOfAny(before, VISIT_PLAN_MARKERS)
  const servicePos = lastIndexOfAny(before, SERVICE_DATE_MARKERS)
  const nearest = Math.max(visitPos, servicePos)
  if (nearest < 0 || before.length - nearest > 48) return null

  if (visitPos >= 0 && visitPos >= servicePos) return "visit_plan"
  if (servicePos >= 0) return "service"
  return null
}

export function extractRecordBeforePlan(
  text: string | string[] | null | undefined
): RecordBeforePlanHit | null {
  const src = joinTexts(text)
  if (!src) return null

  const re = new RegExp(DATE_TOKEN_RE.source, "g")
  let visitPlanOn: string | null = null
  let earliestServiceOn: string | null = null
  let match: RegExpExecArray | null

  while ((match = re.exec(src))) {
    const iso = parseLabeledDate(match[0])
    if (!iso) continue
    const before = src.slice(Math.max(0, match.index - CONTEXT_CHARS), match.index)
    const kind = classifyDateContext(before)
    if (kind === "visit_plan") {
      if (!visitPlanOn || iso > visitPlanOn) visitPlanOn = iso
    } else if (kind === "service") {
      if (!earliestServiceOn || iso < earliestServiceOn) {
        earliestServiceOn = iso
      }
    }
  }

  if (!visitPlanOn || !earliestServiceOn) return null
  return { visitPlanOn, earliestServiceOn }
}

export function findRecordBeforePlanFinding(
  text: string | string[] | null | undefined
): DifyFindingItem | null {
  const hit = extractRecordBeforePlan(text)
  if (!hit) return null
  if (hit.earliestServiceOn >= hit.visitPlanOn) return null

  const plan = formatIsoDateJa(hit.visitPlanOn)
  const service = formatIsoDateJa(hit.earliestServiceOn)

  return {
    severity: "high",
    title: "計画の作成より前の提供日がある可能性があります",
    description: `読み取れた範囲では、訪問介護計画の作成・更新日（${plan}）より前の提供日（${service}）があります。計画前の実施記録や日付の転記誤りの可能性があります。ご確認ください。`,
    basis: "書類同士の日付整合（計画前の提供日）",
    suggestion:
      "訪問介護計画の作成日と提供記録の実施日を見比べ、計画に沿った提供になっているかご確認ください。最終判断・提出は貴施設の責任で行ってください。",
    checkType: "consistency",
    comparison: [
      { source: "訪問介護計画", detail: `作成・更新日：${plan}` },
      { source: "サービス提供記録", detail: `提供日：${service}` },
    ],
  }
}

export function isSimilarRecordBeforePlanFinding(item: {
  title?: string | null
  description?: string | null
}): boolean {
  const blob = `${item.title ?? ""}\n${item.description ?? ""}`
  return /計画の作成より前の提供日|計画前の提供/.test(blob)
}
