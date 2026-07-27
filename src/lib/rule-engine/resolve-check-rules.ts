import {
  matchesPhase1RuleText,
  shouldScopeCheckRulesToPhase1,
} from "@/lib/phase1-audit"
import {
  classifyRuleScope,
  isRuleApplicableToCity,
} from "@/lib/rule-engine/city-rule-scope"
import { prefectureFromMunicipality } from "@/lib/municipalities"
import type { DocType, FindingSeverity } from "@/types/database"

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

export type AppliedRulesSnapshot = {
  asOf: string
  ruleCount: number
  truncated: boolean
  rules: Array<{
    versionId: string
    code: string
    title: string
    versionNo: number
    severity: FindingSeverity
    effectiveFrom: string
    effectiveTo: string | null
    auditItemTitle: string | null
    sourceTitle: string | null
  }>
  regulatoryBasis: Array<{
    id: string
    title: string
    year: number | null
    regionName: string | null
    jurisdictionLevel: string | null
  }>
}

const MAX_RULES = 40
const MAX_BASIS = 12
const MAX_GUIDANCE = 400

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

function matchesDocType(
  targetDocTypes: string[] | null | undefined,
  docType: string
): boolean {
  if (!targetDocTypes || targetDocTypes.length === 0) return true
  return targetDocTypes.includes(docType)
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

/**
 * 承認済み AI 判定ルールと根拠資料タイトルを解決する（Service Role 前提）。
 * 自治体×ルールセットの厳密フィルタは将来拡張。まずは承認済み・有効・書類種別で絞る。
 */
export async function resolveApprovedRulesForCheck(
  admin: AdminClient,
  options: {
    municipality: string
    docType: DocType | string
    asOf?: string
    limit?: number
    /** true=Phase1項目のみ（既定は CHECK_RULES_SCOPE） */
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
      const targets = row.target_doc_types as string[] | null
      if (!matchesDocType(targets, options.docType)) return false
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
  const prefectureName = cityName
    ? prefectureFromMunicipality(cityName) || "神奈川県"
    : ""

  for (const [ruleId, ver] of Array.from(bestByRule.entries())) {
    const rule = ruleById.get(ruleId)
    if (!rule) continue
    const auditRaw = rule.audit_items
    const audit = (
      Array.isArray(auditRaw) ? auditRaw[0] : auditRaw
    ) as Record<string, unknown> | null

    if (cityName) {
      const draftRaw = ver.knowledge_document_change_drafts
      const draft = (
        Array.isArray(draftRaw) ? draftRaw[0] : draftRaw
      ) as {
        knowledge_documents:
          | {
              region_name: string | null
              jurisdiction_level: string | null
              title: string
            }
          | Array<{
              region_name: string | null
              jurisdiction_level: string | null
              title: string
            }>
          | null
      } | null
      const docRaw = draft?.knowledge_documents
      const doc = (Array.isArray(docRaw) ? docRaw[0] : docRaw) as {
        region_name: string | null
        jurisdiction_level: string | null
        title: string
      } | null
      const evidence = extractEvidence(ver.check_logic)
      const scope = classifyRuleScope({
        cityName,
        prefectureName,
        regionName: doc?.region_name ?? evidence.regionName,
        jurisdictionLevel:
          doc?.jurisdiction_level ?? evidence.jurisdictionLevel,
        evidenceRegionName: evidence.regionName,
        evidenceJurisdictionLevel: evidence.jurisdictionLevel,
        changeSummary: (ver.change_summary as string | null) ?? null,
      })
      if (!isRuleApplicableToCity(scope)) continue
    }

    resolved.push({
      versionId: ver.id as string,
      ruleId,
      code: (rule.code as string) || "",
      title: (rule.title as string) || "",
      versionNo: Number(ver.version_no) || 1,
      guidanceText: String(ver.guidance_text ?? "").slice(0, MAX_GUIDANCE),
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
  }

  return { asOf, rules, regulatoryBasis, truncated }
}

function extractEvidence(logic: unknown): {
  regionName: string | null
  jurisdictionLevel: string | null
} {
  if (!logic || typeof logic !== "object") {
    return { regionName: null, jurisdictionLevel: null }
  }
  const evidence = (logic as { evidence?: Record<string, unknown> }).evidence
  if (!evidence || typeof evidence !== "object") {
    return { regionName: null, jurisdictionLevel: null }
  }
  return {
    regionName:
      typeof evidence.regionName === "string" ? evidence.regionName : null,
    jurisdictionLevel:
      typeof evidence.jurisdictionLevel === "string"
        ? evidence.jurisdictionLevel
        : null,
  }
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

/** Dify 入力用の短い JSON 文字列（個人情報なし） */
export function serializeRulesForDify(rules: ResolvedCheckRule[]): string {
  if (rules.length === 0) return "[]"
  return JSON.stringify(
    rules.map((r) => ({
      code: r.code,
      title: r.title,
      version_no: r.versionNo,
      version_id: r.versionId,
      severity: r.severity,
      guidance: r.guidanceText,
      effective_from: r.effectiveFrom,
      audit_item: r.auditItemTitle,
    }))
  ).slice(0, 60000)
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
  resolution: CheckRulesResolution
): AppliedRulesSnapshot {
  return {
    asOf: resolution.asOf,
    ruleCount: resolution.rules.length,
    truncated: resolution.truncated,
    rules: resolution.rules.map((r) => ({
      versionId: r.versionId,
      code: r.code,
      title: r.title,
      versionNo: r.versionNo,
      severity: r.severity,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      auditItemTitle: r.auditItemTitle,
      sourceTitle: r.sourceTitle,
    })),
    regulatoryBasis: resolution.regulatoryBasis.map((b) => ({
      id: b.id,
      title: b.title,
      year: b.year,
      regionName: b.regionName,
      jurisdictionLevel: b.jurisdictionLevel,
    })),
  }
}
