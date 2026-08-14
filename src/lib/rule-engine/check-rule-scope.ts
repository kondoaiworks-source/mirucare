/**
 * 判定ルールの所属（国・県の共通 / 市固有）と、チェック適用の足し方。
 * 横浜のチェック ＝ 国・県で承認した共通ルール ＋ 横浜市で承認したルール
 */

import { PHASE1_CITIES } from "@/lib/rule-engine/phase1-cities"
import { servicePath } from "@/lib/rule-engine/services"

export type CheckRuleScopeKind = "shared" | "city"

export type CheckRuleManageContext = {
  serviceSlug: string
  serviceLabel: string
  scopeKind: CheckRuleScopeKind
  /** city のとき必須。shared は null */
  jurisdictionId: string | null
  citySlug?: string
  cityName?: string
}

export function formatAllocatedRuleCode(prefix: string, seq: number): string {
  const cleaned = prefix
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  const p = cleaned || "R"
  return `${p}-${String(seq).padStart(6, "0")}`
}

export function ruleCodePrefix(context: CheckRuleManageContext): string {
  if (context.scopeKind === "shared") return "SHR"
  const slug = context.citySlug?.trim() || "CITY"
  return slug.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || "CITY"
}

export function viewRulebookPath(
  serviceSlug: string,
  citySlug?: string | null
): string {
  const base = servicePath(serviceSlug, "book")
  const slug = citySlug?.trim()
  if (!slug) return base
  return `${base}?city=${encodeURIComponent(slug)}`
}

export function checkRulesManagePath(context: CheckRuleManageContext): string {
  return viewRulebookPath(context.serviceSlug, context.citySlug)
}

export function checkRulesManualPath(context: CheckRuleManageContext): string {
  return `${checkRulesManagePath(context)}/manual`
}

export function checkRulesParentPath(context: CheckRuleManageContext): string {
  return servicePath(context.serviceSlug)
}

/**
 * 資料の管轄から、判定ルール管理の場所を決める。
 */
export function checkRulesManagePathFromDocument(input: {
  serviceSlug?: string
  jurisdictionLevel?: string | null
  regionName?: string | null
}): string {
  const serviceSlug = input.serviceSlug?.trim() || "homecare"
  const level = input.jurisdictionLevel?.trim() ?? ""
  const region = input.regionName?.trim() ?? ""

  if (level === "国" || level === "national" || level === "都道府県" || level === "prefecture") {
    return viewRulebookPath(serviceSlug)
  }

  if (level === "市区町村" || level === "municipality") {
    const city = PHASE1_CITIES.find(
      (c) => region === c.name || region.includes(c.name)
    )
    if (city) {
      return viewRulebookPath(serviceSlug, city.slug)
    }
  }

  return "/admin/rules/setup"
}

export function documentMatchesRuleScope(
  doc: {
    jurisdiction_level?: string | null
    region_name?: string | null
    layer?: string | null
  },
  context: Pick<CheckRuleManageContext, "scopeKind" | "cityName">
): boolean {
  const level = doc.jurisdiction_level?.trim() ?? ""
  const layer = doc.layer?.trim() ?? ""
  const region = doc.region_name?.trim() ?? ""

  if (context.scopeKind === "shared") {
    return (
      layer === "national" ||
      layer === "prefecture" ||
      level === "国" ||
      level === "national" ||
      level === "都道府県" ||
      level === "prefecture"
    )
  }

  const cityName = context.cityName?.trim() ?? ""
  if (!cityName) return false
  const isCityLayer =
    layer === "city" || level === "市区町村" || level === "municipality"
  return isCityLayer && (region === cityName || region.includes(cityName))
}

/**
 * 市の書類チェックに載せるか。共通は全市、市固有はその市だけ。
 */
export function isRuleInMunicipalityCheckScope(input: {
  scopeKind: CheckRuleScopeKind | string | null | undefined
  ruleJurisdictionId: string | null | undefined
  cityJurisdictionId: string | null | undefined
}): boolean {
  const kind = input.scopeKind === "city" ? "city" : "shared"
  if (kind === "shared") return true
  return Boolean(
    input.cityJurisdictionId &&
      input.ruleJurisdictionId &&
      input.ruleJurisdictionId === input.cityJurisdictionId
  )
}
