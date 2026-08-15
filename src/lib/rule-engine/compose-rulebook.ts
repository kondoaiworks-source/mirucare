/**
 * サービス × 領域 × 自治体 からルールブック下書きを組み立てる純ロジック。
 */

import type { AuditItemCategory, DocType, FindingSeverity } from "@/types/database"
import {
  ruleMatchesDomain,
  templateItemMatchesDomain,
  type RuleDomainMatchInput,
} from "@/lib/rule-engine/domains"
import type { HomeVisitAuditTemplateItem } from "@/lib/rule-engine/home-visit-audit-template"
import { PHASE1_AI_RULE_SEEDS } from "@/lib/phase1-ai-rules-seed"

export type ComposeOrigin = "existing" | "template" | "manual" | "city_pdf" | "official"

export type ComposeTemplatePick = {
  domainId: string
  item: HomeVisitAuditTemplateItem
}

export type ExistingComposeRule = {
  id: string
  code: string
  title: string
  domainId: string | null
  templateCode?: string | null
  scopeKind?: "shared" | "city"
  guidanceText?: string | null
  reviewStatus?: string | null
  latestVersionNo?: number
}

export type ComposeExtractionLayer = "national" | "prefecture" | "city"

export type ComposeExtractionStatus =
  | "extracted"
  | "no_sources"
  | "no_text"
  | "ai_unavailable"
  | "ai_failed"
  | "empty"
  | "gap_filled"

export type ComposeExtractionNote = {
  layer: ComposeExtractionLayer
  label: string
  status: ComposeExtractionStatus
  sourceCount: number
  textCount: number
  ruleCount: number
  message: string
}

/** 本文0件のとき、了承画面と抽出メモで使う */
export const COMPOSE_NO_TEXT_HINT =
  "資料庫でリンクを開き、PDFの直リンクに直してから下書きを作り直してください。"

export function pickTemplateItemsForDomains(input: {
  items: readonly HomeVisitAuditTemplateItem[]
  domains: Array<RuleDomainMatchInput & { id: string }>
}): ComposeTemplatePick[] {
  const seen = new Set<string>()
  const out: ComposeTemplatePick[] = []
  for (const domain of input.domains) {
    for (const item of input.items) {
      if (seen.has(item.code)) continue
      if (!templateItemMatchesDomain(item, domain)) continue
      seen.add(item.code)
      out.push({ domainId: domain.id, item })
    }
  }
  return out
}

export function findExistingRuleForTemplate(
  rules: ExistingComposeRule[],
  item: HomeVisitAuditTemplateItem
): ExistingComposeRule | undefined {
  return rules.find(
    (r) =>
      r.templateCode === item.code ||
      r.code === item.code ||
      r.title === item.title ||
      r.title === `${item.section}／${item.title}`
  )
}

export function extraExistingRulesForDomain(
  rules: ExistingComposeRule[],
  domain: RuleDomainMatchInput & { id: string },
  alreadyPickedIds: Set<string>
): ExistingComposeRule[] {
  return rules.filter((r) => {
    if (alreadyPickedIds.has(r.id)) return false
    if (r.domainId === domain.id) return true
    return ruleMatchesDomain(r, domain)
  })
}

export function docTypesForTemplateCategory(
  category: HomeVisitAuditTemplateItem["category"]
): DocType[] {
  if (category === "計画") return ["ケアプラン"]
  if (category === "記録") return ["提供記録"]
  if (category === "人員") return ["勤務表"]
  if (category === "加算" || category === "請求") return ["請求データ"]
  return ["その他"]
}

export function composeItemTitle(item: HomeVisitAuditTemplateItem): string {
  return `${item.section}／${item.title}`
}

const THIN_GUIDANCE_MARKERS = [
  "監査項目（最大公約数）",
  "の観点です。関連書類・記録をご確認ください",
]

const COMPARISON_BY_CODE: Record<string, string> = {
  HC_GOV_MANAGER_PLACEMENT:
    "勤務表・雇用契約・資格証で、管理者が配置されているか、兼務で常勤換算が足りない可能性がないかご確認ください。指定基準の管理者と勤務実態がずれていないかもご確認ください。",
  HC_GOV_SERVICE_RESPONSIBLE_PERSON:
    "勤務表・資格証で、サービス提供責任者の配置人数と資格が基準を下回っていないか、兼務で実態とずれていないかご確認ください。",
  HC_GOV_DESIGNATION_RENEWAL:
    "指定通知・更新申請の控えで、指定の有効期限が切れていないか、更新後の内容が運営規程と食い違っていないかご確認ください。",
  HC_GOV_CHANGE_NOTICE:
    "変更届の控えと運営規程・勤務表で、届出が必要な変更が未提出のままになっていないかご確認ください。",
  HC_GOV_EMPLOYMENT_CONTRACT:
    "雇用契約書と勤務表で、契約上の勤務と実態の配置が食い違っていないか、未契約の従業者がいないかご確認ください。",
  HC_GOV_QUALIFICATION_CERT:
    "資格証の写しと勤務表で、配置に必要な資格が欠けていないか、有効期限切れの可能性がないかご確認ください。",
  HC_GOV_TRAINING_RECORD:
    "研修実施記録と年間計画で、法定研修の実施漏れや、受講者と勤務表上の職員に食い違いがないかご確認ください。",
  HC_CONTRACT_SERVICE_CONTRACT:
    "契約書と重要事項説明書で、契約日・署名・同意欄が欠けていないか、サービス内容が計画と食い違っていないかご確認ください。",
  HC_CONTRACT_IMPORTANT_MATTERS:
    "重要事項説明書と契約書で、説明日・署名・交付の記録が欠けていないか、料金や苦情窓口が最新と食い違っていないかご確認ください。",
  HC_CONTRACT_PERSONAL_INFO_CONSENT:
    "個人情報同意書と契約関係書類で、同意の日付・署名が欠けていないかご確認ください。",
  HC_PLAN_USER_CONSENT:
    "訪問介護計画の同意欄と交付記録で、利用者（または家族）の同意日が欠けていないか、計画変更後に再同意がない可能性をご確認ください。",
}

function categoryComparisonGuidance(
  item: HomeVisitAuditTemplateItem
): string {
  const topic = `「${item.section}／${item.title}」`
  const byCategory: Record<AuditItemCategory, string> = {
    人員: `勤務表・雇用契約・資格証で、${topic}が指定基準とずれていないか、未記載や兼務で常勤換算が足りない可能性がないかご確認ください。`,
    契約: `契約書・重要事項説明書で、${topic}の日付・署名・同意が欠けていないか、最新版と食い違っていないかご確認ください。`,
    計画: `ケアプランと訪問介護計画で、${topic}に食い違いや未記載がないかご確認ください。`,
    記録: `サービス提供記録と計画・勤務表で、${topic}が一致しているか、未記載がないかご確認ください。`,
    加算: `加算の算定根拠資料と提供記録・勤務表で、${topic}の要件を満たしているか、根拠が薄い可能性がないかご確認ください。`,
    請求: `請求データと提供記録で、${topic}に件数・日付のずれがないかご確認ください。`,
    その他: `運営規程・委員会記録・研修記録で、${topic}の実施・見直しが確認できるか、記録漏れがないかご確認ください。`,
  }
  return byCategory[item.category]
}

/** 項目名のメモになっており、書類との見比べに使えないルール */
export function isThinComposeGuidance(text: string | null | undefined): boolean {
  const t = (text ?? "").trim()
  if (!t) return true
  return THIN_GUIDANCE_MARKERS.some((m) => t.includes(m))
}

export function composeItemGuidance(item: HomeVisitAuditTemplateItem): string {
  const byCode = COMPARISON_BY_CODE[item.code]
  if (byCode) return byCode
  const seed = PHASE1_AI_RULE_SEEDS.find((s) => s.code === item.code)
  if (seed?.guidanceText) return seed.guidanceText
  return categoryComparisonGuidance(item)
}

export function parseExtractionNotes(raw: unknown): ComposeExtractionNote[] {
  if (!Array.isArray(raw)) return []
  const layers: ComposeExtractionLayer[] = ["national", "prefecture", "city"]
  return raw.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const r = row as Record<string, unknown>
    const layer = layers.find((l) => l === r.layer)
    if (!layer) return []
    return [
      {
        layer,
        label: String(r.label ?? ""),
        status: (r.status as ComposeExtractionStatus) ?? "empty",
        sourceCount: Number(r.sourceCount) || 0,
        textCount: Number(r.textCount) || 0,
        ruleCount: Number(r.ruleCount) || 0,
        message: String(r.message ?? ""),
      },
    ]
  })
}

export function summarizeExtractionNotes(
  notes: ComposeExtractionNote[]
): string {
  if (notes.length === 0) return ""
  const extracted = notes.filter((n) => n.ruleCount > 0)
  if (extracted.length > 0) {
    const parts = extracted.map((n) => `${n.label} ${n.ruleCount}件`)
    const problems = notes.filter(
      (n) => n.ruleCount === 0 && n.status !== "no_sources"
    )
    const head = `公式資料から${parts.join("、")}を載せました。`
    if (problems.length === 0) return head
    return `${head} ${problems.map((n) => n.message).join(" ")}`
  }
  return notes.map((n) => n.message).join(" ")
}

/** 資料（PDF）1件ずつの抽出結果。層全体を1回のAI呼び出しにまとめない。 */
export type PerDocExtractOutcome = {
  attempted: number
  succeeded: number
  failed: number
  created: number
  timedOut: boolean
  unavailable: boolean
}

export function emptyPerDocExtractOutcome(): PerDocExtractOutcome {
  return {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    created: 0,
    timedOut: false,
    unavailable: false,
  }
}

export function resolvePerDocExtractStatus(
  outcome: PerDocExtractOutcome
): ComposeExtractionStatus | undefined {
  if (outcome.unavailable) return "ai_unavailable"
  if (outcome.created > 0) return "extracted"
  if (outcome.succeeded > 0) return "empty"
  if (outcome.attempted > 0 || outcome.timedOut) return "ai_failed"
  return undefined
}

export function extraForPerDocExtract(
  label: string,
  outcome: PerDocExtractOutcome,
  status: ComposeExtractionStatus | undefined
): string | undefined {
  if (!status) return undefined

  if (outcome.timedOut && outcome.attempted === 0) {
    return `${label}の資料は、時間の都合で今回は読んでいません。下書きを作り直すと読みます。`
  }

  const failedPart =
    outcome.failed > 0
      ? `本文 ${outcome.failed}件は観点を出せませんでした。`
      : ""
  const timePart = outcome.timedOut
    ? "時間の都合で一部の資料は読んでいません。下書きを作り直すと再度読みます。"
    : ""
  const tail = [failedPart, timePart].filter(Boolean).join(" ")
  if (!tail) return undefined

  if (status === "extracted") {
    return `${label}の公式資料から ${outcome.created}件を載せました。 ${tail}`
  }
  if (status === "empty") {
    return `${label}の資料は確認しましたが、新たに出す観点はありませんでした。 ${tail}`
  }
  if (status === "ai_failed") {
    return `${label}の資料は確認しましたが、観点を自動で出せませんでした。 ${tail}`
  }
  return undefined
}

export function defaultComposeSeverity(
  item: HomeVisitAuditTemplateItem
): FindingSeverity {
  return item.riskLevel
}

export function pickDomainForCityProposal(
  proposal: { title: string; guidanceText: string; auditItemTitle?: string },
  domains: Array<RuleDomainMatchInput & { id: string }>
): string | null {
  const hay = {
    code: "",
    title: `${proposal.title} ${proposal.guidanceText} ${proposal.auditItemTitle ?? ""}`,
  }
  for (const domain of domains) {
    if (ruleMatchesDomain(hay, domain)) return domain.id
  }
  return domains[0]?.id ?? null
}

export function isDuplicateCityProposalTitle(
  proposalTitle: string,
  existingTitles: string[]
): boolean {
  const needle = proposalTitle.trim()
  if (!needle) return true
  return existingTitles.some((t) => t.trim() === needle)
}

export function templateCodeFromCheckLogic(
  checkLogic: Record<string, unknown> | null | undefined
): string | null {
  if (!checkLogic || typeof checkLogic !== "object") return null
  const code = checkLogic.templateCode
  return typeof code === "string" && code.trim() ? code.trim() : null
}
