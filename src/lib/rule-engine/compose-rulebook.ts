/**
 * サービス × 領域 × 自治体 からルールブック下書きを組み立てる純ロジック。
 */

import type { DocType, FindingSeverity } from "@/types/database"
import {
  ruleMatchesDomain,
  templateItemMatchesDomain,
  type RuleDomainMatchInput,
} from "@/lib/rule-engine/domains"
import type { HomeVisitAuditTemplateItem } from "@/lib/rule-engine/home-visit-audit-template"

export type ComposeOrigin = "existing" | "template" | "manual" | "city_pdf"

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
}

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

export function composeItemGuidance(item: HomeVisitAuditTemplateItem): string {
  return item.description
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
