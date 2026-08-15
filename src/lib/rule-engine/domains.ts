/**
 * チェック領域マスタ（人員基準・勤務表・加算・減算・請求要件）。
 * 「全て」はマスタ行ではなく、運用中領域をまとめて選ぶ仮想選択肢。
 */

import type { AuditItemCategory } from "@/types/database"

export const ALL_DOMAINS_VALUE = "__all__" as const

export type RuleDomainStatus = "active" | "retired"

export type RuleDomainSeed = {
  slug: string
  title: string
  description: string
  keywords: string[]
  templateCategories: AuditItemCategory[]
  templateCodes: string[]
  sortOrder: number
  isSystem: true
}

export type RuleDomainMatchInput = {
  slug: string
  title: string
  keywords: string[]
  templateCategories: string[]
  templateCodes: string[]
}

/** 初期投入。slug は変更しない。SQL シードと一致させること。 */
export const SYSTEM_DOMAIN_SEEDS: readonly RuleDomainSeed[] = [
  {
    slug: "staffing",
    title: "人員基準",
    description:
      "常勤換算・管理者・サービス提供責任者・資格など、配置の基準をご確認ください。",
    keywords: [
      "人員",
      "常勤換算",
      "配置",
      "管理者",
      "サービス提供責任者",
      "資格",
      "勤務形態",
    ],
    templateCategories: ["人員"],
    templateCodes: [
      "HC_GOV_STAFFING_STANDARDS",
      "HC_GOV_MANAGER_PLACEMENT",
      "HC_GOV_SERVICE_RESPONSIBLE_PERSON",
      "HC_GOV_WORK_PATTERN_LIST",
      "HC_GOV_QUALIFICATION_CERT",
      "HC_GOV_EMPLOYMENT_CONTRACT",
      "HC_GOV_TRAINING_RECORD",
    ],
    sortOrder: 10,
    isSystem: true,
  },
  {
    slug: "shift-table",
    title: "勤務表",
    description:
      "シフト・勤務表と提供記録の担当・時間の食い違いをご確認ください。",
    keywords: ["勤務表", "シフト", "勤務形態一覧"],
    templateCategories: [],
    templateCodes: [
      "HC_GOV_WORK_PATTERN_LIST",
      "HC_PLAN_ASSIGNEE",
      "HC_RECORD_SERVICE_DATETIME",
    ],
    sortOrder: 20,
    isSystem: true,
  },
  {
    slug: "addition-reduction",
    title: "加算・減算",
    description:
      "加算の算定要件と、減算につながりやすい記録・体制の抜けをご確認ください。",
    keywords: [
      "加算",
      "減算",
      "特定事業所",
      "処遇改善",
      "初回加算",
      "緊急時",
    ],
    templateCategories: ["加算"],
    templateCodes: ["HC_BILLING_ADDITION_EVIDENCE"],
    sortOrder: 30,
    isSystem: true,
  },
  {
    slug: "billing",
    title: "請求要件",
    description:
      "請求と実績・提供記録の一致、請求漏れ・過誤の可能性をご確認ください。",
    keywords: ["請求", "国保連", "実績", "過誤", "報酬"],
    templateCategories: ["請求"],
    templateCodes: [],
    sortOrder: 40,
    isSystem: true,
  },
] as const

export function isAllDomainsValue(value: string | null | undefined): boolean {
  return value === ALL_DOMAINS_VALUE
}

export function parseKeywordInput(raw: string): string[] {
  const parts = raw
    .split(/[,、\n]/g)
    .map((s) => s.trim())
    .filter(Boolean)
  return Array.from(new Set(parts))
}

export function formatKeywords(keywords: string[]): string {
  return keywords.join("、")
}

export function parseCodeList(raw: string): string[] {
  const parts = raw
    .split(/[,、\n\s]+/g)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  return Array.from(new Set(parts))
}

export function slugifyDomainTitle(title: string): string | null {
  const ascii = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  if (ascii.length >= 2) return ascii
  return null
}

export function fallbackDomainSlug(): string {
  return `d-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`
}

export function allocateDomainSlug(title: string, existingSlugs: string[]): string {
  const taken = new Set(existingSlugs.map((s) => s.toLowerCase()))
  const base = slugifyDomainTitle(title) ?? fallbackDomainSlug()
  if (!taken.has(base.toLowerCase())) return base
  for (let i = 2; i < 50; i += 1) {
    const candidate = `${base}-${i}`.slice(0, 48)
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return fallbackDomainSlug()
}

export function canChangeDomainSlug(isSystem: boolean): boolean {
  return !isSystem
}

export function canDeleteDomain(input: {
  isSystem: boolean
  linkedRuleCount: number
}): { ok: true } | { ok: false; error: string } {
  if (input.isSystem) {
    return {
      ok: false,
      error:
        "最初から入っている領域は削除できません。使わない場合は停止してください。",
    }
  }
  if (input.linkedRuleCount > 0) {
    return {
      ok: false,
      error:
        "この領域には判定ルールが紐づいています。削除せず停止してください。",
    }
  }
  return { ok: true }
}

function includesKeyword(hay: string, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return false
  return hay.includes(needle)
}

export function templateItemMatchesDomain(
  item: { code: string; title: string; section?: string; category?: string },
  domain: RuleDomainMatchInput
): boolean {
  if (domain.templateCodes.includes(item.code)) return true
  if (
    item.category &&
    domain.templateCategories.includes(item.category)
  ) {
    return true
  }
  const hay = `${item.code} ${item.title} ${item.section ?? ""} ${item.category ?? ""}`.toLowerCase()
  return domain.keywords.some((kw) => includesKeyword(hay, kw))
}

export function ruleMatchesDomain(
  rule: { code: string; title: string },
  domain: RuleDomainMatchInput
): boolean {
  if (domain.templateCodes.includes(rule.code)) return true
  const hay = `${rule.code} ${rule.title}`.toLowerCase()
  if (domain.keywords.some((kw) => includesKeyword(hay, kw))) return true
  if (domain.title && includesKeyword(hay, domain.title)) return true
  return false
}

export function resolveSelectedDomains<T extends { id: string; status: string }>(
  selected: string,
  domains: T[]
): { all: boolean; domains: T[] } | { error: string } {
  const active = domains.filter((d) => d.status === "active")
  if (isAllDomainsValue(selected)) {
    if (active.length === 0) {
      return { error: "運用中の領域がありません。領域マスタをご確認ください。" }
    }
    return { all: true, domains: active }
  }

  const ids = selected
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (ids.length === 0) {
    return { error: "領域を選択してください。" }
  }

  const hits: T[] = []
  for (const id of ids) {
    const hit = domains.find((d) => d.id === id)
    if (!hit) {
      return { error: "領域を選択してください。" }
    }
    if (hit.status !== "active") {
      return { error: "停止中の領域では、新しいルールブックを作れません。" }
    }
    if (!hits.some((h) => h.id === hit.id)) hits.push(hit)
  }

  const all =
    hits.length === active.length &&
    active.every((a) => hits.some((h) => h.id === a.id))
  return { all, domains: hits }
}

/** チェック状態を domainValue（全て or カンマ区切りID）にする */
export function encodeDomainSelection(
  selectedIds: string[],
  activeIds: string[]
): string {
  const unique = Array.from(new Set(selectedIds.filter(Boolean)))
  if (unique.length === 0) return ""
  const selectedSet = new Set(unique)
  const allSelected =
    activeIds.length > 0 &&
    activeIds.every((id) => selectedSet.has(id)) &&
    unique.length === activeIds.length
  if (allSelected) return ALL_DOMAINS_VALUE
  return unique.join(",")
}
