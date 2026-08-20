import {
  matchesPhase1RuleText,
  shouldScopeCheckRulesToPhase1,
} from "@/lib/phase1-audit"
import { isRuleInMunicipalityCheckScope } from "@/lib/rule-engine/check-rule-scope"
import { prefectureFromMunicipality } from "@/lib/municipalities"
import { PHASE1_CITIES } from "@/lib/rule-engine/phase1-cities"
import type { DocType, FindingSeverity } from "@/types/database"
import {
  APPROVED_RULES_JSON_MAX_CHARS,
  DB_GUIDANCE_LOAD_MAX_CHARS,
  extractPriorityGuidance,
  GUIDANCE_MIN_CHARS,
  hashGuidanceText,
  perRuleGuidanceBudget,
} from "@/lib/rule-engine/guidance-for-dify"

/** Dify 入力・書類スナップショット用のコンパクトなルール要約 */
export type ResolvedCheckRule = {
  versionId: string
  ruleId: string
  code: string
  title: string
  versionNo: number
  guidanceText: string
  severity: FindingSeverity
  effectiveFrom: string
  effectiveTo: string | null
  auditItemTitle: string | null
  sourceTitle: string | null
}

export type ResolvedRegulatoryBasis = {
  id: string
  title: string
  year: number | null
  regionName: string | null
  jurisdictionLevel: string | null
}

export type CheckRulesResolution = {
  asOf: string
  rules: ResolvedCheckRule[]
  regulatoryBasis: ResolvedRegulatoryBasis[]
  truncated: boolean
}

export type AppliedRulesSnapshotRule = {
  versionId: string
  code: string
  title: string
  versionNo: number
  severity: FindingSeverity
  effectiveFrom: string
  effectiveTo: string | null
  auditItemTitle: string | null
  sourceTitle: string | null
  /** 元 guidance の SHA-256 先頭 */
  guidanceHash?: string
  guidanceLength?: number
  guidanceSentLength?: number
  guidanceTruncated?: boolean
  /** Dify へ実際に渡した本文（ルール。個人情報は含めない） */
  guidanceSent?: string
}

export type AppliedRulesSnapshot = {
  asOf: string
  ruleCount: number
  truncated: boolean
  approvedRulesJsonLength?: number
  rules: AppliedRulesSnapshotRule[]
  regulatoryBasis: Array<{
    id: string
    title: string
    year: number | null
    regionName: string | null
    jurisdictionLevel: string | null
  }>
}

export type SerializedRuleForDify = {
  code: string
  title: string
  version_no: number
  version_id: string
  severity: FindingSeverity
  guidance: string
  effective_from: string
  audit_item: string | null
  guidance_truncated: boolean
}

export type SerializedRulesPayload = {
  json: string
  items: SerializedRuleForDify[]
  approvedRulesJsonLength: number
  budgetPerRule: number
}

const MAX_RULES = 60
const MAX_BASIS = 12

type AdminClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function isEffectiveOn(
  effectiveFrom: string,
  effectiveTo: string | null,
  asOf: string
): boolean {
  if (effectiveFrom > asOf) return false
  if (effectiveTo && effectiveTo < asOf) return false
  return true
}

async function loadCityJurisdictionId(
  admin: AdminClient,
  municipality: string
): Promise<string | null> {
  const name = municipality.trim()
  if (!name) return null
  const phase1 = PHASE1_CITIES.find((c) => c.name === name)
  if (phase1) {
    const { data } = await admin
      .from("rule_jurisdictions")
      .select("id")
      .eq("code", phase1.code)
      .maybeSingle()
    return (data?.id as string | undefined) ?? null
  }
  const { data } = await admin
    .from("rule_jurisdictions")
    .select("id")
    .eq("level", "municipality")
    .or(`municipality_name.eq.${name},name.eq.${name}`)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

/**
 * 承認済み判定ルールを解決する（Service Role 前提）。
 * 市のチェック ＝ 国・県で承認した共通ルール ＋ その市で承認したルール。
 * 書類種別（target_doc_types）では絞らない（了承済みルールブック全体を渡す）。
 */
export async function resolveApprovedRulesForCheck(
  admin: AdminClient,
  options: {
    municipality: string
    /** ログ用。ルール解決の絞り込みには使わない */
    docType?: DocType | string
    asOf?: string
    limit?: number
    /** true=従来の基本突合のみ。既定は承認済み頻出観点ルールを使う */
    phase1Only?: boolean
  }
): Promise<CheckRulesResolution> {
  const asOf = options.asOf ?? todayIsoDate()
  const limit = Math.min(Math.max(options.limit ?? MAX_RULES, 1), 80)
  const phase1Only =
    options.phase1Only ?? shouldScopeCheckRulesToPhase1()

  const { data: ruleRows, error: rulesError } = await admin
    .from("ai_check_rules")
    .select(
      `
      id,
      code,
      title,
      target_doc_types,
      status,
      audit_item_id,
      scope_kind,
      jurisdiction_id,
      audit_items ( id, title, source_id, status )
    `
    )
    .eq("status", "active")
    .limit(300)

  if (rulesError || !ruleRows) {
    console.error("[check] resolve_rules_failed", {
      message: rulesError?.message?.slice(0, 160),
    })
    return { asOf, rules: [], regulatoryBasis: [], truncated: false }
  }

  const matchingRules = (ruleRows as Array<Record<string, unknown>>).filter(
    (row) => {
      if (!phase1Only) return true
      const auditRaw = row.audit_items
      const audit = (
        Array.isArray(auditRaw) ? auditRaw[0] : auditRaw
      ) as Record<string, unknown> | null
      return matchesPhase1RuleText(
        row.code as string | undefined,
        row.title as string | undefined,
        (audit?.title as string | undefined) ?? null
      )
    }
  )

  const ruleIds = matchingRules.map((r) => r.id as string)
  if (ruleIds.length === 0) {
    const basis = await loadRegulatoryBasis(admin, options.municipality)
    return { asOf, rules: [], regulatoryBasis: basis, truncated: false }
  }

  const { data: versionRows, error: versionsError } = await admin
    .from("ai_check_rule_versions")
    .select(
      `
      id,
      rule_id,
      version_no,
      guidance_text,
      severity,
      effective_from,
      effective_to,
      review_status,
      change_summary,
      check_logic,
      knowledge_document_change_drafts (
        knowledge_documents ( region_name, jurisdiction_level, title )
      )
    `
    )
    .in("rule_id", ruleIds)
    .eq("review_status", "approved")
    .order("version_no", { ascending: false })
    .limit(500)

  if (versionsError || !versionRows) {
    console.error("[check] resolve_versions_failed", {
      message: versionsError?.message?.slice(0, 160),
    })
    const basis = await loadRegulatoryBasis(admin, options.municipality)
    return { asOf, rules: [], regulatoryBasis: basis, truncated: false }
  }

  const ruleById = new Map(
    matchingRules.map((r) => [r.id as string, r] as const)
  )
  const bestByRule = new Map<string, Record<string, unknown>>()

  for (const ver of versionRows as Array<Record<string, unknown>>) {
    const ruleId = ver.rule_id as string
    if (bestByRule.has(ruleId)) continue
    if (
      !isEffectiveOn(
        ver.effective_from as string,
        (ver.effective_to as string | null) ?? null,
        asOf
      )
    ) {
      continue
    }
    bestByRule.set(ruleId, ver)
  }

  const severityRank: Record<string, number> = {
    high: 0,
    mid: 1,
    low: 2,
  }

  const resolved: ResolvedCheckRule[] = []
  const cityName = options.municipality.trim()
  const cityJurisdictionId = cityName
    ? await loadCityJurisdictionId(admin, cityName)
    : null

  for (const [ruleId, ver] of Array.from(bestByRule.entries())) {
    const rule = ruleById.get(ruleId)
    if (!rule) continue
    const auditRaw = rule.audit_items
    const audit = (
      Array.isArray(auditRaw) ? auditRaw[0] : auditRaw
    ) as Record<string, unknown> | null

    if (
      !isRuleInMunicipalityCheckScope({
        scopeKind: (rule.scope_kind as string | null) ?? "shared",
        ruleJurisdictionId: (rule.jurisdiction_id as string | null) ?? null,
        cityJurisdictionId,
      })
    ) {
      continue
    }

    resolved.push({
      versionId: ver.id as string,
      ruleId,
      code: (rule.code as string) || "",
      title: (rule.title as string) || "",
      versionNo: Number(ver.version_no) || 1,
      guidanceText: String(ver.guidance_text ?? "").slice(
        0,
        DB_GUIDANCE_LOAD_MAX_CHARS
      ),
      severity: (ver.severity as FindingSeverity) || "mid",
      effectiveFrom: ver.effective_from as string,
      effectiveTo: (ver.effective_to as string | null) ?? null,
      auditItemTitle: (audit?.title as string | undefined) ?? null,
      sourceTitle: null,
    })
  }

  resolved.sort((a, b) => {
    const sr = severityRank[a.severity] - severityRank[b.severity]
    if (sr !== 0) return sr
    return a.code.localeCompare(b.code, "ja")
  })

  const truncated = resolved.length > limit
  const rules = resolved.slice(0, limit)
  const regulatoryBasis = await loadRegulatoryBasis(
    admin,
    options.municipality
  )

  if (phase1Only) {
    console.error("[check] phase1_rules_scope", {
      asOf,
      docType: options.docType,
      ruleCount: rules.length,
      truncated,
    })
  } else {
    console.error("[check] frequent_guidance_rules_scope", {
      asOf,
      docType: options.docType,
      ruleCount: rules.length,
      truncated,
    })
  }

  return { asOf, rules, regulatoryBasis, truncated }
}

async function loadRegulatoryBasis(
  admin: AdminClient,
  municipality: string
): Promise<ResolvedRegulatoryBasis[]> {
  const { data, error } = await admin
    .from("knowledge_documents")
    .select("id, title, applicable_year, region_name, jurisdiction_level, status")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(40)
  if (error || !data) {
    console.error("[check] resolve_basis_failed", {
      message: error?.message?.slice(0, 160),
    })
    return []
  }

  const muni = municipality.trim()
  const rows = data as Array<Record<string, unknown>>
  const preferred = muni
    ? rows.filter((r) => {
        const region = String(r.region_name ?? "")
        const level = String(r.jurisdiction_level ?? "")
        const pref = prefectureFromMunicipality(muni)
        return (
          region.includes(muni) ||
          (pref && region.includes(pref)) ||
          level === "国" ||
          level === "national" ||
          level === "都道府県" ||
          !region
        )
      })
    : rows.filter((r) => {
        const level = String(r.jurisdiction_level ?? "")
        return level === "国" || level === "national" || !r.region_name
      })

  const picked = (preferred.length > 0 ? preferred : rows).slice(0, MAX_BASIS)
  return picked.map((r) => ({
    id: r.id as string,
    title: String(r.title ?? ""),
    year:
      typeof r.applicable_year === "number"
        ? r.applicable_year
        : r.applicable_year
          ? Number(r.applicable_year)
          : null,
    regionName: (r.region_name as string | null) ?? null,
    jurisdictionLevel: (r.jurisdiction_level as string | null) ?? null,
  }))
}

function toDifyRuleItem(
  rule: ResolvedCheckRule,
  budget: number
): SerializedRuleForDify {
  const extracted = extractPriorityGuidance(rule.guidanceText ?? "", budget)
  return {
    code: rule.code,
    title: rule.title,
    version_no: rule.versionNo,
    version_id: rule.versionId,
    severity: rule.severity,
    guidance: extracted.text,
    effective_from: rule.effectiveFrom,
    audit_item: rule.auditItemTitle,
    guidance_truncated: extracted.truncated,
  }
}

/**
 * Dify 入力用 JSON。1ルール 400 文字の先頭切り捨てはしない。
 * 全体 60,000 文字以内に収まるよう、ルール数に応じた予算で優先箇所を残す。
 */
export function buildSerializedRulesPayload(
  rules: ResolvedCheckRule[]
): SerializedRulesPayload {
  if (rules.length === 0) {
    return {
      json: "[]",
      items: [],
      approvedRulesJsonLength: 2,
      budgetPerRule: GUIDANCE_PREFERRED_FALLBACK,
    }
  }

  let budget = perRuleGuidanceBudget(rules.length)
  let items = rules.map((r) => toDifyRuleItem(r, budget))
  let json = JSON.stringify(items)

  for (let i = 0; i < 6 && json.length > APPROVED_RULES_JSON_MAX_CHARS; i++) {
    budget = Math.max(GUIDANCE_MIN_CHARS, Math.floor(budget * 0.82))
    items = rules.map((r) => toDifyRuleItem(r, budget))
    json = JSON.stringify(items)
  }

  if (json.length > APPROVED_RULES_JSON_MAX_CHARS) {
    items = items.map((item) => ({
      ...item,
      guidance: item.guidance.slice(
        0,
        Math.max(200, Math.floor((APPROVED_RULES_JSON_MAX_CHARS / items.length) * 0.6))
      ),
      guidance_truncated: true,
    }))
    json = JSON.stringify(items)
  }

  while (
    json.length > APPROVED_RULES_JSON_MAX_CHARS &&
    items.some((item) => item.guidance.length > 0)
  ) {
    items = items.map((item) => ({
      ...item,
      guidance: item.guidance.slice(
        0,
        Math.max(0, Math.floor(item.guidance.length * 0.7))
      ),
      guidance_truncated: true,
    }))
    json = JSON.stringify(items)
  }

  return {
    json,
    items,
    approvedRulesJsonLength: json.length,
    budgetPerRule: budget,
  }
}

const GUIDANCE_PREFERRED_FALLBACK = 3_000

/** Dify 入力用の JSON 文字列（個人情報なし） */
export function serializeRulesForDify(rules: ResolvedCheckRule[]): string {
  return buildSerializedRulesPayload(rules).json
}

export function serializeRegulatoryBasisForDify(
  items: ResolvedRegulatoryBasis[]
): string {
  if (items.length === 0) return "[]"
  return JSON.stringify(
    items.map((b) => ({
      title: b.title,
      year: b.year,
      region: b.regionName,
      level: b.jurisdictionLevel,
    }))
  ).slice(0, 12000)
}

export function toAppliedRulesSnapshot(
  resolution: CheckRulesResolution,
  sent?: SerializedRulesPayload
): AppliedRulesSnapshot {
  const sentByVersion = new Map(
    (sent?.items ?? []).map((item) => [item.version_id, item] as const)
  )
  return {
    asOf: resolution.asOf,
    ruleCount: resolution.rules.length,
    truncated: resolution.truncated,
    approvedRulesJsonLength: sent?.approvedRulesJsonLength,
    rules: resolution.rules.map((r) => {
      const item = sentByVersion.get(r.versionId)
      const extracted = item
        ? {
            guidanceHash: hashGuidanceText(r.guidanceText ?? ""),
            guidanceLength: (r.guidanceText ?? "").length,
            guidanceSentLength: item.guidance.length,
            guidanceTruncated: item.guidance_truncated,
            guidanceSent: item.guidance,
          }
        : {}
      return {
        versionId: r.versionId,
        code: r.code,
        title: r.title,
        versionNo: r.versionNo,
        severity: r.severity,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        auditItemTitle: r.auditItemTitle,
        sourceTitle: r.sourceTitle,
        ...extracted,
      }
    }),
    regulatoryBasis: resolution.regulatoryBasis.map((b) => ({
      id: b.id,
      title: b.title,
      year: b.year,
      regionName: b.regionName,
      jurisdictionLevel: b.jurisdictionLevel,
    })),
  }
}
