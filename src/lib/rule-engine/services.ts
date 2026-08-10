/**
 * ルール設定の介護サービス選定（運営向け）
 * 施設向けは当面・訪問介護 × Phase1 5市のみ。
 */

import type { ServiceType } from "@/types/database"

export type RuleServiceStatus = "active" | "preparing"

export type RuleServiceDef = {
  slug: string
  serviceType: ServiceType
  label: string
  description: string
  status: RuleServiceStatus
  statusLabel: string
}

export const RULE_SERVICES: readonly RuleServiceDef[] = [
  {
    slug: "homecare",
    serviceType: "訪問介護",
    label: "訪問介護",
    description: "",
    status: "active",
    statusLabel: "運用中",
  },
  {
    slug: "daycare",
    serviceType: "通所介護",
    label: "通所介護",
    description: "",
    status: "preparing",
    statusLabel: "準備中",
  },
  {
    slug: "other",
    serviceType: "その他",
    label: "その他",
    description: "",
    status: "preparing",
    statusLabel: "準備中",
  },
] as const

export function getRuleServiceBySlug(slug: string): RuleServiceDef | undefined {
  return RULE_SERVICES.find((s) => s.slug === slug)
}

export function getRuleServiceByType(
  serviceType: ServiceType
): RuleServiceDef | undefined {
  return RULE_SERVICES.find((s) => s.serviceType === serviceType)
}

export function isRuleServiceSlug(slug: string): boolean {
  return Boolean(getRuleServiceBySlug(slug))
}

/** サービス配下のパス */
export function servicePath(slug: string, ...parts: string[]): string {
  const base = `/admin/rules/services/${slug}`
  if (parts.length === 0) return base
  return `${base}/${parts.join("/")}`
}
