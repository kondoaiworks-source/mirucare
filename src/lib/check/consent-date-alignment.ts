/**
 * 同意日がサービス開始日より後になっている可能性を機械的に拾う。
 */

import type { DifyFindingItem } from "@/lib/dify/types"
import {
  DATE_TOKEN_RE,
  formatIsoDateJa,
  joinTexts,
  lastIndexOfAny,
  parseLabeledDate,
} from "@/lib/check/alignment-shared"

export const CONSENT_DATE_ALIGNMENT_CODE = "HC_CONSENT_VS_START"
export const CONSENT_DATE_ALIGNMENT_VERSION_ID = `builtin:${CONSENT_DATE_ALIGNMENT_CODE}`

const CONTEXT_CHARS = 96
const CONSENT_MARKERS = ["同意日", "利用者同意", "署名日", "同意を得た日"]
const START_MARKERS = [
  "サービス開始日",
  "利用開始日",
  "開始日",
  "提供開始日",
]

export type ConsentDateAlignmentHit = {
  consentOn: string
  startOn: string
}

function classifyDateContext(
  before: string
): "consent" | "start" | null {
  const consentPos = lastIndexOfAny(before, CONSENT_MARKERS)
  const startPos = lastIndexOfAny(before, START_MARKERS)
  const nearest = Math.max(consentPos, startPos)
  if (nearest < 0 || before.length - nearest > 48) return null

  if (consentPos >= 0 && consentPos >= startPos) return "consent"
  if (startPos >= 0) return "start"
  return null
}

export function extractConsentDateAlignment(
  text: string | string[] | null | undefined
): ConsentDateAlignmentHit | null {
  const src = joinTexts(text)
  if (!src) return null

  const re = new RegExp(DATE_TOKEN_RE.source, "g")
  let consentOn: string | null = null
  let startOn: string | null = null
  let match: RegExpExecArray | null

  while ((match = re.exec(src))) {
    const iso = parseLabeledDate(match[0])
    if (!iso) continue
    const before = src.slice(Math.max(0, match.index - CONTEXT_CHARS), match.index)
    const kind = classifyDateContext(before)
    if (kind === "consent") {
      if (!consentOn || iso > consentOn) consentOn = iso
    } else if (kind === "start") {
      if (!startOn || iso < startOn) startOn = iso
    }
  }

  if (!consentOn || !startOn) return null
  return { consentOn, startOn }
}

export function findConsentDateAlignmentFinding(
  text: string | string[] | null | undefined
): DifyFindingItem | null {
  const hit = extractConsentDateAlignment(text)
  if (!hit) return null
  if (hit.consentOn <= hit.startOn) return null

  const consent = formatIsoDateJa(hit.consentOn)
  const start = formatIsoDateJa(hit.startOn)

  return {
    severity: "mid",
    title: "同意日がサービス開始より後になっている可能性があります",
    description: `読み取れた範囲では、サービス開始日（${start}）より同意日（${consent}）が後になっています。同意取得のタイミングや日付記載の誤りの可能性があります。ご確認ください。`,
    basis: "書類同士の日付整合（同意日と開始日）",
    suggestion:
      "重要事項説明・契約同意の日付とサービス開始日を見比べ、開始前に同意が取れているかご確認ください。最終判断・提出は貴施設の責任で行ってください。",
    checkType: "consistency",
    comparison: [
      { source: "同意・署名", detail: `同意日：${consent}` },
      { source: "サービス開始", detail: `開始日：${start}` },
    ],
  }
}

export function isSimilarConsentDateFinding(item: {
  title?: string | null
  description?: string | null
}): boolean {
  const blob = `${item.title ?? ""}\n${item.description ?? ""}`
  return /同意日がサービス開始より後|同意日.*開始.*後/.test(blob)
}
