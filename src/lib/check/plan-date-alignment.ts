/**
 * 書類同士の日付整合（ルールブック非依存）。
 * ケアプラン更新日より訪問介護計画の作成・更新日が古い可能性を機械的に拾う。
 */

import { PHASE1_AI_RULE_SEEDS } from "@/lib/phase1-ai-rules-seed"
import type { ResolvedCheckRule } from "@/lib/rule-engine/resolve-check-rules"
import type { DifyFindingItem } from "@/lib/dify/types"

export const PLAN_DATE_ALIGNMENT_CODE = "HC_PLAN_UPDATED_DATE"
export const PLAN_DATE_ALIGNMENT_VERSION_ID = `builtin:${PLAN_DATE_ALIGNMENT_CODE}`

const CONTEXT_CHARS = 96
/** 標準観点1件＋了承済みルール（resolve 上限60）が載る余裕 */
const MAX_RULES_AFTER_INJECT = 61

const ERA_BASE: Record<string, number> = {
  令和: 2018, // 元年=2019
  平成: 1988,
  昭和: 1925,
}

const DATE_RE =
  /(令和|平成|昭和)\s*([元0-9０-９]{1,2})\s*年\s*([0-9０-９]{1,2})\s*月\s*([0-9０-９]{1,2})\s*日|(20[0-9]{2}|[０-９]{4})\s*年\s*([0-9０-９]{1,2})\s*月\s*([0-9０-９]{1,2})\s*日|(20[0-9]{2})[/\-.]([0-9]{1,2})[/\-.]([0-9]{1,2})/g

const CARE_PLAN_MARKERS = ["ケアプラン", "居宅サービス計画", "居宅介護支援"]
const VISIT_PLAN_MARKERS = ["訪問介護計画"]

export type PlanDateAlignmentHit = {
  carePlanUpdateOn: string
  visitPlanOn: string
}

function joinTexts(text: string | string[] | null | undefined): string {
  if (Array.isArray(text)) {
    return text
      .map((t) => (t ?? "").trim())
      .filter(Boolean)
      .join("\n\n")
  }
  return (text ?? "").trim()
}

function zenkakuToHankakuDigits(raw: string): string {
  return raw.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
  )
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function parseYearToken(raw: string): number | null {
  const t = zenkakuToHankakuDigits(raw.trim())
  if (t === "元") return 1
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parseLabeledDate(raw: string): string | null {
  const text = zenkakuToHankakuDigits(raw).replace(/\s+/g, "")
  const era = text.match(/^(令和|平成|昭和)(元|\d{1,2})年(\d{1,2})月(\d{1,2})日$/)
  if (era) {
    const base = ERA_BASE[era[1] ?? ""]
    const y = parseYearToken(era[2] ?? "")
    const m = Number(era[3])
    const d = Number(era[4])
    if (base == null || y == null || m < 1 || m > 12 || d < 1 || d > 31) {
      return null
    }
    return `${base + y}-${pad2(m)}-${pad2(d)}`
  }
  const west = text.match(/^(20\d{2})年(\d{1,2})月(\d{1,2})日$/)
  if (west) {
    const m = Number(west[2])
    const d = Number(west[3])
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    return `${west[1]}-${pad2(m)}-${pad2(d)}`
  }
  const iso = text.match(/^(20\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
  if (iso) {
    const m = Number(iso[2])
    const d = Number(iso[3])
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    return `${iso[1]}-${pad2(m)}-${pad2(d)}`
  }
  return null
}

export function formatIsoDateJa(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${y}年${Number(m)}月${Number(d)}日`
}

function lastIndexOfAny(hay: string, needles: string[]): number {
  let best = -1
  for (const n of needles) {
    const i = hay.lastIndexOf(n)
    if (i > best) best = i
  }
  return best
}

function classifyDateContext(
  before: string
): "care_plan_update" | "visit_plan" | null {
  const visitPos = lastIndexOfAny(before, VISIT_PLAN_MARKERS)
  const carePos = lastIndexOfAny(before, CARE_PLAN_MARKERS)
  const nearest = Math.max(visitPos, carePos)
  // 日付直前のラベルのみ採用（セット結合時に遠い見出しを引きずらない）
  if (nearest < 0 || before.length - nearest > 48) return null

  if (visitPos >= 0 && visitPos >= carePos) {
    return "visit_plan"
  }
  if (carePos >= 0) {
    const tail = before.slice(carePos)
    if (/更新|変更/.test(tail)) return "care_plan_update"
  }
  return null
}

export function extractPlanDateAlignment(
  text: string | string[] | null | undefined
): PlanDateAlignmentHit | null {
  const src = joinTexts(text)
  if (!src) return null

  const re = new RegExp(DATE_RE.source, "g")
  let carePlanUpdateOn: string | null = null
  let visitPlanOn: string | null = null
  let match: RegExpExecArray | null

  while ((match = re.exec(src))) {
    const iso = parseLabeledDate(match[0])
    if (!iso) continue
    const start = match.index
    const before = src.slice(Math.max(0, start - CONTEXT_CHARS), start)
    const kind = classifyDateContext(before)
    if (kind === "care_plan_update") {
      if (!carePlanUpdateOn || iso > carePlanUpdateOn) carePlanUpdateOn = iso
    } else if (kind === "visit_plan") {
      if (!visitPlanOn || iso > visitPlanOn) visitPlanOn = iso
    }
  }

  if (!carePlanUpdateOn || !visitPlanOn) return null
  return { carePlanUpdateOn, visitPlanOn }
}

export function findPlanDateAlignmentFinding(
  text: string | string[] | null | undefined
): DifyFindingItem | null {
  const hit = extractPlanDateAlignment(text)
  if (!hit) return null
  if (hit.visitPlanOn >= hit.carePlanUpdateOn) return null

  const seed = PHASE1_AI_RULE_SEEDS.find(
    (s) => s.code === PLAN_DATE_ALIGNMENT_CODE
  )
  const care = formatIsoDateJa(hit.carePlanUpdateOn)
  const visit = formatIsoDateJa(hit.visitPlanOn)

  return {
    severity: seed?.severity ?? "mid",
    title: "訪問介護計画の日付がケアプラン更新に追いついていない可能性があります",
    description: `読み取れた範囲では、ケアプランの更新日（${care}）より訪問介護計画の作成・更新日（${visit}）が前になっています。計画の見直し漏れの可能性があります。ご確認ください。`,
    basis: "書類同士の日付整合（計画の更新日の確認）",
    suggestion:
      "ケアプラン変更後に訪問介護計画を見直し、作成日・更新日がケアプランに追いついているかご確認ください。最終判断・提出は貴施設の責任で行ってください。",
    checkType: "consistency",
    comparison: [
      {
        source: "居宅サービス計画（ケアプラン）",
        detail: `更新日：${care}`,
      },
      {
        source: "訪問介護計画",
        detail: `作成・更新日：${visit}`,
      },
    ],
  }
}

export function isSimilarPlanDateFinding(item: {
  title?: string | null
  description?: string | null
}): boolean {
  const blob = `${item.title ?? ""}\n${item.description ?? ""}`
  return /計画の更新日|追いついていない可能性|ケアプラン更新に追いつ/.test(blob)
}

export function mergeFindingsWithPlanDateAlignment(
  aiFindings: DifyFindingItem[],
  alignment: DifyFindingItem | null
): DifyFindingItem[] {
  if (!alignment) return aiFindings
  const rest = aiFindings.filter((f) => !isSimilarPlanDateFinding(f))
  return [alignment, ...rest]
}

export function builtinPlanDateAlignmentRule(): ResolvedCheckRule {
  const seed = PHASE1_AI_RULE_SEEDS.find(
    (s) => s.code === PLAN_DATE_ALIGNMENT_CODE
  )
  return {
    versionId: PLAN_DATE_ALIGNMENT_VERSION_ID,
    ruleId: PLAN_DATE_ALIGNMENT_VERSION_ID,
    code: PLAN_DATE_ALIGNMENT_CODE,
    title: seed?.title ?? "計画の更新日の確認",
    versionNo: 1,
    guidanceText: seed?.guidanceText ?? "",
    severity: seed?.severity ?? "mid",
    effectiveFrom: "2024-04-01",
    effectiveTo: null,
    auditItemTitle: "書類同士の日付整合",
    sourceTitle: "標準観点（ルールブック非依存）",
  }
}

/** Dify 入力・スナップショットへ、日付整合の標準観点を必ず載せる。 */
export function withBuiltinPlanDateAlignmentRule(
  rules: ResolvedCheckRule[]
): ResolvedCheckRule[] {
  const builtin = builtinPlanDateAlignmentRule()
  const rest = rules.filter((r) => r.code !== builtin.code)
  return [builtin, ...rest].slice(0, MAX_RULES_AFTER_INJECT)
}
