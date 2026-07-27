/**
 * 市ルールブック／チェック適用で使う「この市の範囲か」判定。
 * 国・県・未紐付け（共通シード）は全市で共有。他市専用は除外。
 */

import { PHASE1_CITIES } from "@/lib/rule-engine/phase1-cities"

export type RuleScopeKind = "city" | "shared" | "other_city" | "unscoped"

export type RuleScopeInput = {
  cityName: string
  prefectureName: string
  /** 紐づく資料の地域名 */
  regionName?: string | null
  jurisdictionLevel?: string | null
  /** check_logic.evidence に保存した地域 */
  evidenceRegionName?: string | null
  evidenceJurisdictionLevel?: string | null
  changeSummary?: string | null
}

function includesName(haystack: string | null | undefined, name: string): boolean {
  if (!haystack?.trim() || !name.trim()) return false
  return haystack.includes(name)
}

function otherPhase1CityName(
  cityName: string,
  text: string | null | undefined
): string | null {
  if (!text?.trim()) return null
  for (const c of PHASE1_CITIES) {
    if (c.name === cityName) continue
    if (text.includes(c.name)) return c.name
  }
  return null
}

/**
 * ルール版が、指定市のルールブック／チェック対象に入るか分類する。
 */
export function classifyRuleScope(input: RuleScopeInput): RuleScopeKind {
  const region =
    input.regionName?.trim() ||
    input.evidenceRegionName?.trim() ||
    null
  const level =
    input.jurisdictionLevel?.trim() ||
    input.evidenceJurisdictionLevel?.trim() ||
    null
  const summary = input.changeSummary?.trim() || null

  if (
    includesName(region, input.cityName) ||
    includesName(summary, input.cityName)
  ) {
    return "city"
  }

  const otherFromRegion = otherPhase1CityName(input.cityName, region)
  if (otherFromRegion) return "other_city"

  const otherFromSummary = otherPhase1CityName(input.cityName, summary)
  if (otherFromSummary && !includesName(summary, input.cityName)) {
    // 他市名だけが概要にある場合は他市扱い
    if (
      !includesName(summary, "国") &&
      !includesName(summary, input.prefectureName)
    ) {
      return "other_city"
    }
  }

  if (
    level === "国" ||
    level === "national" ||
    includesName(region, "国") ||
    includesName(summary, "国の")
  ) {
    return "shared"
  }

  if (
    level === "都道府県" ||
    level === "prefecture" ||
    includesName(region, input.prefectureName) ||
    includesName(summary, input.prefectureName)
  ) {
    return "shared"
  }

  if (!region && !level && !summary) {
    return "unscoped"
  }

  // 地域情報はあるが自市・他市・国県に該当しない → 共有寄り（県外など）は除外せず共有扱いしない
  // 未分類で地域だけある場合は unscoped（シード等）
  if (!region && !level) {
    return "unscoped"
  }

  // 地域名はあるが Phase1 他市でも自市でもない → shared にはせず unscoped
  return "unscoped"
}

export function isRuleApplicableToCity(kind: RuleScopeKind): boolean {
  return kind === "city" || kind === "shared" || kind === "unscoped"
}

export const RULE_SCOPE_LABEL: Record<RuleScopeKind, string> = {
  city: "市固有",
  shared: "国・県（共有）",
  other_city: "他市（対象外）",
  unscoped: "共通",
}
