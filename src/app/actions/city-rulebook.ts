"use server"

import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import {
  getPhase1CityBySlug,
  KANAGAWA_JURISDICTION_CODE,
  NATIONAL_JURISDICTION_CODE,
  type Phase1City,
} from "@/lib/rule-engine/phase1-cities"
import {
  classifyRuleScope,
  isRuleApplicableToCity,
  type RuleScopeKind,
} from "@/lib/rule-engine/city-rule-scope"
import type {
  KnowledgeDocument,
  KnowledgeDocumentChangeDraft,
  KnowledgeSyncAlert,
  RuleJurisdiction,
  RuleSource,
} from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

export type CityRulebookSource = RuleSource & {
  layer: "national" | "prefecture" | "city"
  jurisdictionName: string
}

export type CityRulebookDocument = KnowledgeDocument & {
  layer: "national" | "prefecture" | "city"
}

export type CityRulebookDraft = KnowledgeDocumentChangeDraft & {
  knowledge_documents: Pick<
    KnowledgeDocument,
    "id" | "title" | "region_name" | "jurisdiction_level" | "applicable_year"
  > | null
}

export type CityRulebookAlert = KnowledgeSyncAlert & {
  knowledge_documents: Pick<
    KnowledgeDocument,
    "id" | "title" | "region_name" | "jurisdiction_level"
  > | null
}

export type CityRulebookCheckRule = {
  versionId: string
  ruleId: string
  code: string
  title: string
  versionNo: number
  guidanceText: string
  severity: "high" | "mid" | "low"
  effectiveFrom: string
  changeSummary: string | null
  scopeKind: "city" | "shared" | "other_city" | "unscoped"
  sourceDocumentTitle: string | null
  reviewStatus: "approved" | "pending_review"
}

export type CityRulebookData = {
  city: Phase1City
  jurisdiction: RuleJurisdiction
  sources: CityRulebookSource[]
  documents: CityRulebookDocument[]
  pendingDrafts: CityRulebookDraft[]
  openAlerts: CityRulebookAlert[]
  /** この市のチェック用中身（了承済み） */
  approvedCheckRules: CityRulebookCheckRule[]
  /** この市関連の判定ルール案（承認待ち） */
  pendingCheckRules: CityRulebookCheckRule[]
  counts: {
    citySources: number
    cityDocuments: number
    sharedSources: number
    sharedDocuments: number
    pendingDrafts: number
    openAlerts: number
    approvedCheckRules: number
    pendingCheckRules: number
  }
}

function docLayer(
  doc: Pick<KnowledgeDocument, "jurisdiction_level" | "region_name">,
  city: Phase1City
): "national" | "prefecture" | "city" | null {
  if (doc.jurisdiction_level === "国") return "national"
  if (
    doc.jurisdiction_level === "都道府県" &&
    (doc.region_name === city.prefectureName ||
      doc.region_name?.includes(city.prefectureName))
  ) {
    return "prefecture"
  }
  if (
    doc.jurisdiction_level === "市区町村" &&
    (doc.region_name === city.name || doc.region_name?.includes(city.name))
  ) {
    return "city"
  }
  return null
}

/**
 * Phase1 市のルールブック確定版ビュー用データを取得する。
 * 国＋県＋市を束ね、更新アラート（差分・同期）も市関連に絞る。
 */
export async function getCityRulebookAction(
  slug: string
): Promise<ActionResult<CityRulebookData>> {
  const city = getPhase1CityBySlug(slug)
  if (!city) {
    return { ok: false, error: "対象の市が見つかりません。" }
  }

  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { data: cityJurisdiction, error: cityErr } = await op.service
    .from("rule_jurisdictions")
    .select("*")
    .eq("code", city.code)
    .maybeSingle()

  if (cityErr) {
    return { ok: false, error: toUserErrorMessage(cityErr) }
  }
  if (!cityJurisdiction) {
    return {
      ok: false,
      error:
        "自治体マスタにこの市がありません。マイグレーションと自治体マスタをご確認ください。",
    }
  }

  const { data: sharedJurisdictions } = await op.service
    .from("rule_jurisdictions")
    .select("id, code, name")
    .in("code", [NATIONAL_JURISDICTION_CODE, KANAGAWA_JURISDICTION_CODE])

  const sharedByCode = new Map(
    (sharedJurisdictions ?? []).map((j) => [j.code as string, j])
  )
  const nationalId = sharedByCode.get(NATIONAL_JURISDICTION_CODE)?.id
  const prefectureId = sharedByCode.get(KANAGAWA_JURISDICTION_CODE)?.id
  const jurisdictionIds = [
    cityJurisdiction.id as string,
    nationalId,
    prefectureId,
  ].filter(Boolean) as string[]

  const [sourcesRes, docsRes, draftsRes, alertsRes] = await Promise.all([
    op.service
      .from("rule_sources")
      .select(
        `
        *,
        rule_jurisdictions ( id, name, code, municipality_name, level )
      `
      )
      .in("jurisdiction_id", jurisdictionIds)
      .eq("status", "active")
      .order("priority", { ascending: true })
      .limit(500),
    op.service
      .from("knowledge_documents")
      .select("*")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(300),
    op.service
      .from("knowledge_document_change_drafts")
      .select(
        `
        *,
        knowledge_documents (
          id,
          title,
          applicable_year,
          region_name,
          jurisdiction_level
        )
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100),
    op.service
      .from("knowledge_sync_alerts")
      .select(
        `
        *,
        knowledge_documents (
          id,
          title,
          region_name,
          jurisdiction_level
        )
      `
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  if (sourcesRes.error) {
    return { ok: false, error: toUserErrorMessage(sourcesRes.error) }
  }
  if (docsRes.error) {
    return { ok: false, error: toUserErrorMessage(docsRes.error) }
  }

  const sources: CityRulebookSource[] = (sourcesRes.data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const jRaw = r.rule_jurisdictions
    const j = (Array.isArray(jRaw) ? jRaw[0] : jRaw) as {
      id: string
      name: string
      code: string
    } | null
    const code = j?.code ?? ""
    let layer: CityRulebookSource["layer"] = "city"
    if (code === NATIONAL_JURISDICTION_CODE) layer = "national"
    else if (code === KANAGAWA_JURISDICTION_CODE) layer = "prefecture"
    return {
      ...(row as RuleSource),
      layer,
      jurisdictionName: j?.name ?? city.name,
    }
  })

  const documents: CityRulebookDocument[] = []
  for (const raw of docsRes.data ?? []) {
    const doc = raw as KnowledgeDocument
    const layer = docLayer(doc, city)
    if (!layer) continue
    documents.push({ ...doc, layer })
  }

  const relevantDocIds = new Set(documents.map((d) => d.id))

  const pendingDrafts: CityRulebookDraft[] = (draftsRes.data ?? [])
    .map((row) => {
      const r = row as Record<string, unknown>
      const kd = r.knowledge_documents
      const doc = (Array.isArray(kd) ? kd[0] : kd) as
        | CityRulebookDraft["knowledge_documents"]
        | null
      return {
        ...(row as KnowledgeDocumentChangeDraft),
        knowledge_documents: doc,
      }
    })
    .filter((d) => {
      if (relevantDocIds.has(d.knowledge_document_id)) return true
      const doc = d.knowledge_documents
      if (!doc) return false
      return docLayer(doc, city) !== null
    })

  const openAlerts: CityRulebookAlert[] = (alertsRes.data ?? [])
    .map((row) => {
      const r = row as Record<string, unknown>
      const kd = r.knowledge_documents
      const doc = (Array.isArray(kd) ? kd[0] : kd) as
        | CityRulebookAlert["knowledge_documents"]
        | null
      return {
        ...(row as KnowledgeSyncAlert),
        knowledge_documents: doc,
      }
    })
    .filter((a) => {
      if (
        a.knowledge_document_id &&
        relevantDocIds.has(a.knowledge_document_id)
      ) {
        return true
      }
      const doc = a.knowledge_documents
      if (!doc) return false
      return docLayer(doc, city) !== null
    })

  const citySources = sources.filter((s) => s.layer === "city")
  const sharedSources = sources.filter((s) => s.layer !== "city")
  const cityDocuments = documents.filter((d) => d.layer === "city")
  const sharedDocuments = documents.filter((d) => d.layer !== "city")

  const checkRules = await loadCityCheckRules(op.service, city)

  return {
    ok: true,
    data: {
      city,
      jurisdiction: cityJurisdiction as RuleJurisdiction,
      sources,
      documents,
      pendingDrafts,
      openAlerts,
      approvedCheckRules: checkRules.approved,
      pendingCheckRules: checkRules.pending,
      counts: {
        citySources: citySources.length,
        cityDocuments: cityDocuments.length,
        sharedSources: sharedSources.length,
        sharedDocuments: sharedDocuments.length,
        pendingDrafts: pendingDrafts.length,
        openAlerts: openAlerts.length,
        approvedCheckRules: checkRules.approved.length,
        pendingCheckRules: checkRules.pending.length,
      },
    },
  }
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function evidenceFromLogic(logic: unknown): {
  regionName: string | null
  jurisdictionLevel: string | null
  sourceTitle: string | null
} {
  if (!logic || typeof logic !== "object") {
    return { regionName: null, jurisdictionLevel: null, sourceTitle: null }
  }
  const evidence = (logic as { evidence?: Record<string, unknown> }).evidence
  if (!evidence || typeof evidence !== "object") {
    return { regionName: null, jurisdictionLevel: null, sourceTitle: null }
  }
  return {
    regionName:
      typeof evidence.regionName === "string" ? evidence.regionName : null,
    jurisdictionLevel:
      typeof evidence.jurisdictionLevel === "string"
        ? evidence.jurisdictionLevel
        : null,
    sourceTitle:
      typeof evidence.sourceTitle === "string" ? evidence.sourceTitle : null,
  }
}

async function loadCityCheckRules(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  city: Phase1City
): Promise<{
  approved: CityRulebookCheckRule[]
  pending: CityRulebookCheckRule[]
}> {
  const asOf = todayIsoDate()
  const { data, error } = await service
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
      knowledge_change_draft_id,
      ai_check_rules ( id, code, title, status ),
      knowledge_document_change_drafts (
        id,
        knowledge_documents ( id, title, region_name, jurisdiction_level )
      )
    `
    )
    .in("review_status", ["approved", "pending_review"])
    .order("created_at", { ascending: false })
    .limit(300)

  if (error || !data) {
    console.error("[city-rulebook] load_check_rules_failed", {
      message: error?.message?.slice(0, 160),
    })
    return { approved: [], pending: [] }
  }

  const bestApprovedByRule = new Map<string, CityRulebookCheckRule>()
  const pending: CityRulebookCheckRule[] = []

  for (const row of data as Array<Record<string, unknown>>) {
    const ruleRaw = row.ai_check_rules
    const rule = (
      Array.isArray(ruleRaw) ? ruleRaw[0] : ruleRaw
    ) as {
      id: string
      code: string
      title: string
      status: string
    } | null
    if (!rule || rule.status !== "active") continue

    const draftRaw = row.knowledge_document_change_drafts
    const draft = (
      Array.isArray(draftRaw) ? draftRaw[0] : draftRaw
    ) as {
      knowledge_documents:
        | {
            title: string
            region_name: string | null
            jurisdiction_level: string | null
          }
        | Array<{
            title: string
            region_name: string | null
            jurisdiction_level: string | null
          }>
        | null
    } | null
    const docRaw = draft?.knowledge_documents
    const doc = (Array.isArray(docRaw) ? docRaw[0] : docRaw) as {
      title: string
      region_name: string | null
      jurisdiction_level: string | null
    } | null

    const evidence = evidenceFromLogic(row.check_logic)
    const scopeKind = classifyRuleScope({
      cityName: city.name,
      prefectureName: city.prefectureName,
      regionName: doc?.region_name ?? evidence.regionName,
      jurisdictionLevel:
        doc?.jurisdiction_level ?? evidence.jurisdictionLevel,
      evidenceRegionName: evidence.regionName,
      evidenceJurisdictionLevel: evidence.jurisdictionLevel,
      changeSummary: (row.change_summary as string | null) ?? null,
    })

    if (!isRuleApplicableToCity(scopeKind)) continue

    const status = row.review_status as "approved" | "pending_review"
    if (status === "approved") {
      const effectiveFrom = String(row.effective_from ?? "")
      const effectiveTo = (row.effective_to as string | null) ?? null
      if (effectiveFrom > asOf) continue
      if (effectiveTo && effectiveTo < asOf) continue
    }

    const item: CityRulebookCheckRule = {
      versionId: row.id as string,
      ruleId: rule.id,
      code: rule.code,
      title: rule.title,
      versionNo: Number(row.version_no) || 1,
      guidanceText: String(row.guidance_text ?? ""),
      severity: (row.severity as CityRulebookCheckRule["severity"]) || "mid",
      effectiveFrom: String(row.effective_from ?? asOf),
      changeSummary: (row.change_summary as string | null) ?? null,
      scopeKind: scopeKind as RuleScopeKind,
      sourceDocumentTitle: doc?.title ?? evidence.sourceTitle,
      reviewStatus: status,
    }

    if (status === "pending_review") {
      pending.push(item)
      continue
    }

    const existing = bestApprovedByRule.get(rule.id)
    if (!existing || item.versionNo > existing.versionNo) {
      bestApprovedByRule.set(rule.id, item)
    }
  }

  const approved = Array.from(bestApprovedByRule.values()).sort((a, b) => {
    const rank = { high: 0, mid: 1, low: 2 }
    const sr = rank[a.severity] - rank[b.severity]
    if (sr !== 0) return sr
    return a.code.localeCompare(b.code, "ja")
  })

  return { approved, pending }
}
