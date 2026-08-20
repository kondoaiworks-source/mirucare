"use server"

import { revalidatePath } from "next/cache"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import { allocateAiCheckRuleCode } from "@/lib/rule-engine/allocate-rule-code"
import { ensureAuditItemOptions } from "@/lib/rule-engine/default-audit-item"
import {
  extraExistingRulesForDomain,
  extraForPerDocExtract,
  findExistingRuleForTemplate,
  pickTemplateItemsForDomains,
  composeItemGuidance,
  composeItemTitle,
  defaultComposeSeverity,
  docTypesForTemplateCategory,
  templateCodeFromCheckLogic,
  pickDomainForCityProposal,
  isDuplicateCityProposalTitle,
  isThinComposeGuidance,
  parseExtractionNotes,
  resolvePerDocExtractStatus,
  summarizeExtractionNotes,
  emptyPerDocExtractOutcome,
  COMPOSE_NO_TEXT_HINT,
  type ExistingComposeRule,
  type ComposeExtractionNote,
  type PerDocExtractOutcome,
} from "@/lib/rule-engine/compose-rulebook"
import { resolveSelectedDomains } from "@/lib/rule-engine/domains"
import { HOME_VISIT_AUDIT_TEMPLATE_ITEMS } from "@/lib/rule-engine/home-visit-audit-template"
import { getPhase1CityBySlug, PHASE1_CITIES, KANAGAWA_JURISDICTION_CODE, NATIONAL_JURISDICTION_CODE } from "@/lib/rule-engine/phase1-cities"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import {
  defaultEffectiveFrom,
  proposeRulesFromSourceText,
} from "@/lib/knowledge/propose-rules"
import { isGeminiConfigured } from "@/lib/knowledge/gemini"
import { ensureKnowledgeDocumentFromRuleSource } from "@/lib/knowledge/ensure-from-rule-source"
import {
  getLatestSnapshot,
  readSnapshotText,
  snapshotNeedsTextBackfill,
} from "@/lib/knowledge/snapshots"
import { isReadablePdfSource } from "@/lib/rule-engine/source-urls"
import type {
  AiCheckRule,
  AiCheckRuleVersion,
  FindingSeverity,
  RuleDomain,
  RuleJurisdiction,
  RulebookComposeItem,
  RulebookComposeJob,
} from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

export type ComposeJobItemView = RulebookComposeItem & {
  rule: Pick<
    AiCheckRule,
    "id" | "code" | "title" | "status" | "scope_kind" | "jurisdiction_id" | "domain_id"
  > | null
  version: Pick<
    AiCheckRuleVersion,
    | "id"
    | "version_no"
    | "guidance_text"
    | "severity"
    | "effective_from"
    | "review_status"
    | "change_summary"
  > | null
  domainTitle: string | null
}

export type ComposeJobView = {
  job: RulebookComposeJob
  serviceLabel: string
  cityName: string
  citySlug: string | null
  layer: "shared" | "city"
  domainLabel: string
  domains: RuleDomain[]
  items: ComposeJobItemView[]
  includedCount: number
  pendingCount: number
  cityCount: number
  sharedCount: number
  extractionNotes: ComposeExtractionNote[]
}

function revalidateCompose(serviceSlug?: string) {
  revalidatePath("/admin/rules/services", "layout")
  if (serviceSlug) {
    revalidatePath(`/admin/rules/services/${serviceSlug}/compose`)
  }
}

function asDomain(row: Record<string, unknown>): RuleDomain {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    keywords: Array.isArray(row.keywords)
      ? row.keywords.map((k) => String(k))
      : [],
    template_categories: Array.isArray(row.template_categories)
      ? row.template_categories.map((k) => String(k))
      : [],
    template_codes: Array.isArray(row.template_codes)
      ? row.template_codes.map((k) => String(k))
      : [],
    sort_order: Number(row.sort_order) || 0,
    status: row.status === "retired" ? "retired" : "active",
    is_system: Boolean(row.is_system),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  }
}

function domainMatchInput(d: RuleDomain) {
  return {
    id: d.id,
    slug: d.slug,
    title: d.title,
    keywords: d.keywords,
    templateCategories: d.template_categories,
    templateCodes: d.template_codes,
  }
}

export async function listComposeOptionsAction(input: {
  serviceSlug: string
}): Promise<
  ActionResult<{
    domains: RuleDomain[]
    municipalities: Array<{
      id: string
      name: string
      slug: string | null
    }>
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }
  const service = getRuleServiceBySlug(input.serviceSlug)
  if (!service) return { ok: false, error: "介護サービスが見つかりません。" }

  const [domainsRes, jurisRes] = await Promise.all([
    op.service
      .from("rule_domains")
      .select("*")
      .eq("status", "active")
      .order("sort_order", { ascending: true }),
    op.service
      .from("rule_jurisdictions")
      .select("id, name, code, municipality_name, is_supported, level")
      .eq("level", "municipality")
      .eq("is_supported", true)
      .order("sort_order", { ascending: true }),
  ])

  if (domainsRes.error) {
    return { ok: false, error: toUserErrorMessage(domainsRes.error) }
  }
  if (jurisRes.error) {
    return { ok: false, error: toUserErrorMessage(jurisRes.error) }
  }

  const municipalities = ((jurisRes.data ?? []) as Array<Record<string, unknown>>)
    .map((j) => {
      const name = String(j.municipality_name || j.name || "")
      const city = PHASE1_CITIES.find(
        (c) => c.name === name || c.code === String(j.code)
      )
      return {
        id: String(j.id),
        name,
        slug: city?.slug ?? null,
      }
    })
    .filter((m) => m.name)

  return {
    ok: true,
    data: {
      domains: (domainsRes.data ?? []).map((r) =>
        asDomain(r as Record<string, unknown>)
      ),
      municipalities,
    },
  }
}

async function loadScopedRules(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  cityJurisdictionId: string
): Promise<
  Array<
    ExistingComposeRule & {
      raw: AiCheckRule
      latestVersion: AiCheckRuleVersion | null
    }
  >
> {
  const { data, error } = await service
    .from("ai_check_rules")
    .select(
      `
      id, code, title, status, scope_kind, jurisdiction_id, domain_id, audit_item_id,
      ai_check_rule_versions (
        id, version_no, guidance_text, severity, effective_from, review_status,
        change_summary, check_logic
      )
    `
    )
    .eq("status", "active")
    .limit(400)

  if (error || !data) return []

  const rows: Array<
    ExistingComposeRule & {
      raw: AiCheckRule
      latestVersion: AiCheckRuleVersion | null
    }
  > = []

  for (const row of data as Array<Record<string, unknown>>) {
    const scopeKind = row.scope_kind === "city" ? "city" : "shared"
    const jurisdictionId = (row.jurisdiction_id as string | null) ?? null
    if (scopeKind === "city" && jurisdictionId !== cityJurisdictionId) {
      continue
    }
    const versions = Array.isArray(row.ai_check_rule_versions)
      ? (row.ai_check_rule_versions as AiCheckRuleVersion[])
      : []
    versions.sort((a, b) => Number(b.version_no) - Number(a.version_no))
    const latest = versions[0] ?? null
    const templateCode = templateCodeFromCheckLogic(
      latest?.check_logic as Record<string, unknown> | null
    )
    rows.push({
      id: String(row.id),
      code: String(row.code ?? ""),
      title: String(row.title ?? ""),
      domainId: (row.domain_id as string | null) ?? null,
      templateCode,
      scopeKind,
      guidanceText: latest?.guidance_text ?? null,
      reviewStatus: latest?.review_status ?? null,
      latestVersionNo: latest ? Number(latest.version_no) : 0,
      raw: row as unknown as AiCheckRule,
      latestVersion: latest,
    })
  }
  return rows
}

const MAX_DOCS_PER_LAYER = 12
const MAX_CHARS_PER_DOC = 12_000
const DOC_GEMINI_TIMEOUT_MS = 60_000
const COMPOSE_EXTRACT_BUDGET_MS = 240_000
const MIN_DOC_TIMEOUT_MS = 12_000
const MAX_PROPOSALS_PER_DOC = 8

type OfficialLayer = "national" | "prefecture" | "city"

type LayerPack = {
  sourceCount: number
  docs: Array<{ title: string; text: string }>
}

type OfficialExtractResult = {
  notes: ComposeExtractionNote[]
  sharedCreated: number
  cityCreated: number
  sharedHasText: boolean
  cityHasText: boolean
  sourceNote: string
}

async function ensureSourceDocumentId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  sourceId: string,
  existingDocId: string | null
): Promise<string | null> {
  if (existingDocId) {
    try {
      const snapshot = await getLatestSnapshot(service, existingDocId)
      if (snapshot && !snapshotNeedsTextBackfill(snapshot)) {
        return existingDocId
      }
    } catch {
      // 本文が無いときは同期を試みる
    }
  }
  try {
    const ensured = await ensureKnowledgeDocumentFromRuleSource(service, sourceId)
    return ensured.knowledgeDocumentId
  } catch (err) {
    console.error("[compose] ensure_source_failed", {
      error: err instanceof Error ? err.message.slice(0, 160) : "unknown",
    })
    return existingDocId
  }
}

function emptyLayerPack(): LayerPack {
  return { sourceCount: 0, docs: [] }
}

function noteForPack(input: {
  layer: OfficialLayer
  label: string
  pack: LayerPack
  ruleCount: number
  status?: ComposeExtractionNote["status"]
  extra?: string
}): ComposeExtractionNote {
  const { pack } = input
  let status = input.status
  if (!status) {
    if (pack.sourceCount === 0) status = "no_sources"
    else if (pack.docs.length === 0) status = "no_text"
    else if (input.ruleCount > 0) status = "extracted"
    else status = "empty"
  }
  const messages: Record<ComposeExtractionNote["status"], string> = {
    extracted: `${input.label}の公式資料から ${input.ruleCount}件を載せました。`,
    no_sources: `${input.label}の資料はまだありません。`,
    no_text: `${input.label}の資料本文がまだありません。${COMPOSE_NO_TEXT_HINT}`,
    ai_unavailable: `${input.label}の資料はありますが、AI設定がないため観点を出せませんでした。`,
    ai_failed: `${input.label}の資料は確認しましたが、観点を自動で出せませんでした。`,
    empty: `${input.label}の資料を確認しました。新しく追加する候補はありませんでした。`,
    gap_filled: `${input.label}の資料が無いため、書類と見比べる標準の観点で穴埋めしました。`,
  }
  return {
    layer: input.layer,
    label: input.label,
    status,
    sourceCount: pack.sourceCount,
    textCount: pack.docs.length,
    ruleCount: input.ruleCount,
    message: input.extra?.trim() || messages[status],
  }
}

async function readDocsForLayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  docs: Array<Record<string, unknown>>
): Promise<Array<{ title: string; text: string }>> {
  const out: Array<{ title: string; text: string }> = []
  for (const doc of docs.slice(0, MAX_DOCS_PER_LAYER)) {
    try {
      const snapshot = await getLatestSnapshot(service, String(doc.id))
      if (!snapshot) continue
      const text = (await readSnapshotText(service, snapshot)).trim()
      if (!text) continue
      out.push({
        title: String(doc.title ?? "資料"),
        text: text.slice(0, MAX_CHARS_PER_DOC),
      })
    } catch {
      continue
    }
  }
  return out
}

async function attachOfficialSourceRules(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any
  jobId: string
  cityName: string
  prefectureName: string
  cityJurisdictionId: string
  citySlug?: string
  serviceLabel: string
  domains: RuleDomain[]
  existingRules: ExistingComposeRule[]
  pickedIds: Set<string>
  auditItemId: string
  auditItems: Array<{ id: string; code: string; title: string }>
  onlyLayers?: OfficialLayer[]
}): Promise<OfficialExtractResult> {
  const empty: OfficialExtractResult = {
    notes: [],
    sharedCreated: 0,
    cityCreated: 0,
    sharedHasText: false,
    cityHasText: false,
    sourceNote: "",
  }
  const cityName = input.cityName.trim()
  if (!cityName) return empty

  const { data: layerRows } = await input.service
    .from("rule_jurisdictions")
    .select("id, code")
    .in("code", [NATIONAL_JURISDICTION_CODE, KANAGAWA_JURISDICTION_CODE])

  const nationalId =
    (
      (layerRows ?? []) as Array<{ id: string; code: string }>
    ).find((r) => r.code === NATIONAL_JURISDICTION_CODE)?.id ?? null
  const prefectureId =
    (
      (layerRows ?? []) as Array<{ id: string; code: string }>
    ).find((r) => r.code === KANAGAWA_JURISDICTION_CODE)?.id ?? null

  const jurisdictionIds = [
    nationalId,
    prefectureId,
    input.cityJurisdictionId,
  ].filter((id): id is string => Boolean(id))

  const { data: sourceRows } = await input.service
    .from("rule_sources")
    .select(
      "id, knowledge_document_id, title, jurisdiction_id, file_type, direct_file_url, parent_page_url, official_url"
    )
    .in("jurisdiction_id", jurisdictionIds)
    .eq("status", "active")
    .limit(40)

  const linkedByLayer: Record<OfficialLayer, Set<string>> = {
    national: new Set(),
    prefecture: new Set(),
    city: new Set(),
  }
  const sourceCountByLayer: Record<OfficialLayer, number> = {
    national: 0,
    prefecture: 0,
    city: 0,
  }

  const layerOfJurisdiction = (jurisdictionId: string): OfficialLayer => {
    if (jurisdictionId === nationalId) return "national"
    if (jurisdictionId === prefectureId) return "prefecture"
    return "city"
  }

  for (const row of (sourceRows ?? []) as Array<{
    id: string
    knowledge_document_id: string | null
    jurisdiction_id: string
    file_type: string | null
    direct_file_url: string | null
    parent_page_url: string | null
    official_url: string | null
  }>) {
    // リンク集（HTML）は件数にも抽出にも入れない
    if (!isReadablePdfSource(row)) continue
    const layer = layerOfJurisdiction(row.jurisdiction_id)
    sourceCountByLayer[layer] += 1
    if (linkedByLayer[layer].size >= MAX_DOCS_PER_LAYER) continue
    const docId = await ensureSourceDocumentId(
      input.service,
      row.id,
      row.knowledge_document_id
    )
    if (docId) linkedByLayer[layer].add(docId)
  }

  const { data: docs } = await input.service
    .from("knowledge_documents")
    .select("id, title, region_name, jurisdiction_level, source_url, status")
    .eq("status", "active")
    .limit(300)

  const docsByLayer: Record<OfficialLayer, Array<Record<string, unknown>>> = {
    national: [],
    prefecture: [],
    city: [],
  }

  for (const doc of (docs ?? []) as Array<Record<string, unknown>>) {
    const id = String(doc.id)
    if (linkedByLayer.national.has(id)) {
      docsByLayer.national.push(doc)
      continue
    }
    if (linkedByLayer.prefecture.has(id)) {
      docsByLayer.prefecture.push(doc)
      continue
    }
    if (linkedByLayer.city.has(id)) {
      docsByLayer.city.push(doc)
    }
  }

  const layerLabels: Record<OfficialLayer, string> = {
    national: "国",
    prefecture: input.prefectureName || "県",
    city: cityName,
  }

  const packs: Record<OfficialLayer, LayerPack> = {
    national: emptyLayerPack(),
    prefecture: emptyLayerPack(),
    city: emptyLayerPack(),
  }
  for (const layer of ["national", "prefecture", "city"] as const) {
    packs[layer] = {
      sourceCount: sourceCountByLayer[layer],
      docs: await readDocsForLayer(input.service, docsByLayer[layer]),
    }
  }

  const sharedHasText =
    packs.national.docs.length + packs.prefecture.docs.length > 0
  const cityHasText = packs.city.docs.length > 0

  const existingTitles = input.existingRules
    .filter((r) => !isThinComposeGuidance(r.guidanceText))
    .map((r) => r.title)
  const domainInputs = input.domains.map(domainMatchInput)
  const effectiveFrom = defaultEffectiveFrom()
  let sharedCreated = 0
  let cityCreated = 0

  type OfficialProposal = {
    title: string
    guidanceText: string
    targetDocTypes: string[]
    auditItemId: string
    severity: "high" | "mid" | "low"
    evidenceSummary: string
    evidenceQuotes: string[]
    scopeKind?: "shared" | "city"
  }

  const buildCitySupplementProposal = (sourceTitle: string): OfficialProposal => {
    const shortTitle = sourceTitle.trim().slice(0, 48) || "公式資料"
    return {
      title: `${cityName}の自治体補足確認（${shortTitle}）`,
      guidanceText:
        `${cityName}の資料「${shortTitle}」と、事業所の届出控え・運営規程・加算届・事故報告控えで、提出先・様式名・期限・記載欄が最新の案内とずれている可能性がないかご確認ください。`,
      targetDocTypes: ["その他"],
      auditItemId: input.auditItemId,
      severity: "low",
      evidenceSummary:
        `${cityName}の公式資料から、市固有の提出先・様式名・期限・記載欄を人が確認するための補足候補です。`,
      evidenceQuotes: [],
      scopeKind: "city",
    }
  }

  const saveProposals = async (
    proposals: OfficialProposal[],
    sourceTitle: string,
    forceScope: "shared" | "city"
  ): Promise<{
    created: number
    duplicateSkipped: number
    thinSkipped: number
  }> => {
    let created = 0
    let duplicateSkipped = 0
    let thinSkipped = 0
    for (const proposal of proposals) {
      if (isDuplicateCityProposalTitle(proposal.title, existingTitles)) {
        duplicateSkipped += 1
        continue
      }
      if (isThinComposeGuidance(proposal.guidanceText)) {
        thinSkipped += 1
        continue
      }
      const domainId = pickDomainForCityProposal(proposal, domainInputs)
      const scopeKind = forceScope
      const code = await allocateAiCheckRuleCode(input.service, {
        scopeKind,
        citySlug: scopeKind === "city" ? input.citySlug : undefined,
      })

      const { data: rule, error: ruleError } = await input.service
        .from("ai_check_rules")
        .insert({
          audit_item_id: proposal.auditItemId || input.auditItemId,
          code,
          title: proposal.title,
          target_doc_types: proposal.targetDocTypes,
          status: "active",
          scope_kind: scopeKind,
          jurisdiction_id:
            scopeKind === "city" ? input.cityJurisdictionId : null,
          domain_id: domainId,
        })
        .select("id")
        .single()
      if (ruleError || !rule) {
        console.error("[compose] official_rule_insert_failed", {
          error: String(ruleError?.message ?? "").slice(0, 160),
        })
        continue
      }

      const { error: verError } = await input.service
        .from("ai_check_rule_versions")
        .insert({
          rule_id: rule.id,
          version_no: 1,
          check_logic: {
            type: "official",
            notes: proposal.guidanceText,
            evidence: {
              sourceTitle,
              evidenceSummary: proposal.evidenceSummary,
              evidenceQuotes: proposal.evidenceQuotes,
              proposedBy: "gemini",
              regionName: cityName,
              jurisdictionLevel: "国・都道府県・市区町村",
              scopeKind,
            },
          },
          guidance_text: proposal.guidanceText,
          severity: proposal.severity,
          effective_from: effectiveFrom,
          review_status: "pending_review",
          change_summary: `公式資料から下書き（${sourceTitle}）`,
        })
      if (verError) {
        console.error("[compose] official_version_insert_failed", {
          error: String(verError.message ?? "").slice(0, 160),
        })
        continue
      }

      const itemPayload = {
        job_id: input.jobId,
        rule_id: rule.id,
        domain_id: domainId,
        included: true,
      }
      const { error: itemError } = await input.service
        .from("rulebook_compose_items")
        .insert({ ...itemPayload, origin: "official" })
      if (itemError) {
        const fallbackOrigin = scopeKind === "city" ? "city_pdf" : "existing"
        const { error: fallbackError } = await input.service
          .from("rulebook_compose_items")
          .insert({ ...itemPayload, origin: fallbackOrigin })
        if (fallbackError) continue
      }

      input.pickedIds.add(rule.id as string)
      existingTitles.push(proposal.title)
      created += 1
      if (scopeKind === "city") cityCreated += 1
      else sharedCreated += 1
    }
    return { created, duplicateSkipped, thinSkipped }
  }

  const extractDeadline = Date.now() + COMPOSE_EXTRACT_BUDGET_MS

  const proposeDocs = async (opts: {
    docs: Array<{ title: string; text: string }>
    label: string
    forceScope: "shared" | "city"
    cityUnique?: boolean
    layered?: boolean
    jurisdictionLevel: string
  }): Promise<PerDocExtractOutcome> => {
    const outcome = emptyPerDocExtractOutcome()
    if (opts.docs.length === 0) return outcome
    if (!isGeminiConfigured()) {
      outcome.unavailable = true
      return outcome
    }
    if (Date.now() >= extractDeadline) {
      outcome.timedOut = true
      return outcome
    }

    for (const doc of opts.docs) {
      const remaining = extractDeadline - Date.now()
      if (remaining < MIN_DOC_TIMEOUT_MS) {
        outcome.timedOut = true
        break
      }
      outcome.attempted += 1
      const timeoutMs = Math.min(DOC_GEMINI_TIMEOUT_MS, remaining)
      const proposed = await proposeRulesFromSourceText({
        documentTitle: doc.title,
        regionName: cityName,
        jurisdictionLevel: opts.jurisdictionLevel,
        sourceText: `===== ${opts.label}資料: ${doc.title} =====\n${doc.text}`,
        auditItems: input.auditItems,
        layered: opts.layered,
        cityUnique: opts.cityUnique,
        skipRetry: true,
        forceScope: opts.forceScope,
        maxProposals: MAX_PROPOSALS_PER_DOC,
        timeoutMs,
        serviceLabel: input.serviceLabel,
        domainLabels: input.domains.map((d) => d.title),
      })
      if (!proposed.ok) {
        outcome.failed += 1
        console.error("[compose] official_propose_failed", {
          scope: opts.forceScope,
          title: doc.title.slice(0, 80),
          error: proposed.error.slice(0, 160),
        })
        continue
      }
      outcome.succeeded += 1
      let proposals: OfficialProposal[] = proposed.proposals
      let usedCitySupplement = false
      if (proposed.proposals.length === 0) {
        outcome.emptyResponses += 1
        if (opts.forceScope === "city" && opts.cityUnique) {
          proposals = [buildCitySupplementProposal(doc.title)]
          usedCitySupplement = true
        }
      }
      const saved = await saveProposals(
        proposals,
        doc.title,
        opts.forceScope
      )
      outcome.created += saved.created
      if (usedCitySupplement) {
        outcome.supplementCreated += saved.created
      }
      outcome.duplicateSkipped += saved.duplicateSkipped
      outcome.thinSkipped += saved.thinSkipped
    }
    return outcome
  }

  const includeShared =
    !input.onlyLayers ||
    input.onlyLayers.includes("national") ||
    input.onlyLayers.includes("prefecture")
  const includeCity = !input.onlyLayers || input.onlyLayers.includes("city")

  let nationalOutcome = emptyPerDocExtractOutcome()
  let prefectureOutcome = emptyPerDocExtractOutcome()
  let cityOutcome = emptyPerDocExtractOutcome()

  if (includeShared && packs.national.docs.length > 0) {
    nationalOutcome = await proposeDocs({
      docs: packs.national.docs,
      label: layerLabels.national,
      forceScope: "shared",
      layered: true,
      jurisdictionLevel: "国・都道府県",
    })
  }
  if (includeShared && packs.prefecture.docs.length > 0) {
    prefectureOutcome = await proposeDocs({
      docs: packs.prefecture.docs,
      label: layerLabels.prefecture,
      forceScope: "shared",
      layered: true,
      jurisdictionLevel: "国・都道府県",
    })
  }
  if (includeCity && packs.city.docs.length > 0) {
    cityOutcome = await proposeDocs({
      docs: packs.city.docs,
      label: layerLabels.city,
      forceScope: "city",
      cityUnique: true,
      jurisdictionLevel: "市区町村",
    })
  }

  const nationalStatus = resolvePerDocExtractStatus(nationalOutcome)
  const prefectureStatus = resolvePerDocExtractStatus(prefectureOutcome)
  const cityStatus = resolvePerDocExtractStatus(cityOutcome)

  const notes: ComposeExtractionNote[] = [
    noteForPack({
      layer: "national",
      label: layerLabels.national,
      pack: packs.national,
      ruleCount: nationalOutcome.created,
      status: nationalStatus,
      extra: extraForPerDocExtract(
        layerLabels.national,
        nationalOutcome,
        nationalStatus
      ),
    }),
    noteForPack({
      layer: "prefecture",
      label: layerLabels.prefecture,
      pack: packs.prefecture,
      ruleCount: prefectureOutcome.created,
      status: prefectureStatus,
      extra: extraForPerDocExtract(
        layerLabels.prefecture,
        prefectureOutcome,
        prefectureStatus
      ),
    }),
    noteForPack({
      layer: "city",
      label: layerLabels.city,
      pack: packs.city,
      ruleCount: cityOutcome.created,
      status: cityStatus,
      extra: extraForPerDocExtract(
        layerLabels.city,
        cityOutcome,
        cityStatus
      ),
    }),
  ]

  const filteredNotes = input.onlyLayers
    ? notes.filter((n) => input.onlyLayers?.includes(n.layer))
    : notes

  return {
    notes: filteredNotes,
    sharedCreated,
    cityCreated,
    sharedHasText: includeShared ? sharedHasText : false,
    cityHasText: includeCity ? cityHasText : false,
    sourceNote: summarizeExtractionNotes(filteredNotes),
  }
}

async function attachLeftoverGoodRules(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any
  jobId: string
  domains: RuleDomain[]
  existingRules: ExistingComposeRule[]
  pickedIds: Set<string>
}): Promise<number> {
  let added = 0
  for (const domain of input.domains) {
    const extras = extraExistingRulesForDomain(
      input.existingRules,
      domainMatchInput(domain),
      input.pickedIds
    )
    for (const extra of extras) {
      if (isThinComposeGuidance(extra.guidanceText)) continue
      const { error } = await input.service.from("rulebook_compose_items").insert({
        job_id: input.jobId,
        rule_id: extra.id,
        domain_id: domain.id,
        origin: "existing",
        included: true,
      })
      if (error) {
        console.error("[compose] leftover_item_failed", {
          error: String(error.message ?? "").slice(0, 160),
        })
        continue
      }
      input.pickedIds.add(extra.id)
      added += 1
    }
  }
  return added
}

async function discardStaleComposeDraft(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  jobId: string
): Promise<void> {
  const { data: items } = await service
    .from("rulebook_compose_items")
    .select("id, rule_id, origin")
    .eq("job_id", jobId)

  for (const item of items ?? []) {
    if (
      item.origin !== "template" &&
      item.origin !== "manual" &&
      item.origin !== "city_pdf" &&
      item.origin !== "official"
    ) {
      continue
    }
    const { data: version } = await service
      .from("ai_check_rule_versions")
      .select("id")
      .eq("rule_id", item.rule_id)
      .eq("review_status", "pending_review")
      .maybeSingle()
    if (!version) continue
    await service.from("ai_check_rule_versions").delete().eq("id", version.id)
    const { count } = await service
      .from("ai_check_rule_versions")
      .select("id", { count: "exact", head: true })
      .eq("rule_id", item.rule_id)
    if ((count ?? 0) === 0) {
      await service.from("ai_check_rules").delete().eq("id", item.rule_id)
    }
  }

  await service
    .from("rulebook_compose_jobs")
    .update({ status: "discarded" })
    .eq("id", jobId)
    .eq("status", "draft")
}

async function saveExtractionNotes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  jobId: string,
  notes: ComposeExtractionNote[]
): Promise<void> {
  const { error } = await service
    .from("rulebook_compose_jobs")
    .update({ extraction_notes: notes })
    .eq("id", jobId)
  if (error) {
    console.error("[compose] extraction_notes_save_failed", {
      error: String(error.message ?? "").slice(0, 160),
    })
  }
}

async function fillTemplateGaps(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any
  jobId: string
  domains: RuleDomain[]
  existingRules: ExistingComposeRule[]
  pickedIds: Set<string>
  auditItemId: string
}): Promise<number> {
  const picks = pickTemplateItemsForDomains({
    items: HOME_VISIT_AUDIT_TEMPLATE_ITEMS,
    domains: input.domains.map(domainMatchInput),
  })
  const effectiveFrom = defaultEffectiveFrom()
  const existingTitles = input.existingRules
    .filter((r) => !isThinComposeGuidance(r.guidanceText))
    .map((r) => r.title)
  let created = 0

  for (const pick of picks) {
    const title = composeItemTitle(pick.item)
    const found = findExistingRuleForTemplate(input.existingRules, pick.item)
    const guidance = composeItemGuidance(pick.item)

    if (found && !isThinComposeGuidance(found.guidanceText)) {
      if (input.pickedIds.has(found.id)) continue
      const { error } = await input.service.from("rulebook_compose_items").insert({
        job_id: input.jobId,
        rule_id: found.id,
        domain_id: pick.domainId,
        origin: "existing",
        included: true,
      })
      if (error) continue
      input.pickedIds.add(found.id)
      existingTitles.push(title)
      continue
    }

    if (found && isThinComposeGuidance(found.guidanceText)) {
      const nextNo = (found.latestVersionNo ?? 0) + 1
      const { error: verError } = await input.service
        .from("ai_check_rule_versions")
        .insert({
          rule_id: found.id,
          version_no: nextNo,
          check_logic: {
            type: "template",
            templateCode: pick.item.code,
            notes: guidance,
          },
          guidance_text: guidance,
          severity: defaultComposeSeverity(pick.item),
          effective_from: effectiveFrom,
          review_status: "pending_review",
          change_summary: `領域テンプレのルールを見比べ文に更新（${pick.item.section}）`,
        })
      if (verError) continue
      const { error: itemError } = await input.service
        .from("rulebook_compose_items")
        .insert({
          job_id: input.jobId,
          rule_id: found.id,
          domain_id: pick.domainId,
          origin: "template",
          included: true,
        })
      if (itemError) continue
      input.pickedIds.add(found.id)
      existingTitles.push(title)
      created += 1
      continue
    }

    const code = await allocateAiCheckRuleCode(input.service, {
      scopeKind: "shared",
    })
    const { data: rule, error: ruleError } = await input.service
      .from("ai_check_rules")
      .insert({
        audit_item_id: input.auditItemId,
        code,
        title,
        target_doc_types: docTypesForTemplateCategory(pick.item.category),
        status: "active",
        scope_kind: "shared",
        jurisdiction_id: null,
        domain_id: pick.domainId,
      })
      .select("id")
      .single()
    if (ruleError || !rule) continue

    const { error: verError } = await input.service
      .from("ai_check_rule_versions")
      .insert({
        rule_id: rule.id,
        version_no: 1,
        check_logic: {
          type: "template",
          templateCode: pick.item.code,
          notes: guidance,
        },
        guidance_text: guidance,
        severity: defaultComposeSeverity(pick.item),
        effective_from: effectiveFrom,
        review_status: "pending_review",
        change_summary: `領域テンプレから下書き（${pick.item.section}）`,
      })
    if (verError) continue

    const { error: itemError } = await input.service
      .from("rulebook_compose_items")
      .insert({
        job_id: input.jobId,
        rule_id: rule.id,
        domain_id: pick.domainId,
        origin: "template",
        included: true,
      })
    if (itemError) continue
    input.pickedIds.add(rule.id as string)
    existingTitles.push(title)
    created += 1
  }
  return created
}

export async function startComposeRulebookAction(input: {
  serviceSlug: string
  domainValue: string
  jurisdictionId: string
  layer: "shared" | "city"
}): Promise<ActionResult<{ jobId: string; sourceNote: string | null }>> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const serviceDef = getRuleServiceBySlug(input.serviceSlug)
  if (!serviceDef) return { ok: false, error: "介護サービスが見つかりません。" }

  const layer = input.layer
  if (layer !== "shared" && layer !== "city") {
    return { ok: false, error: "国・県または自治体を指定してください。" }
  }

  const requestedId = input.jurisdictionId.trim()
  if (layer === "city" && !requestedId) {
    return { ok: false, error: "自治体を選択してください。" }
  }

  const { data: nationalRow } = await op.service
    .from("rule_jurisdictions")
    .select("id, name, municipality_name, code, level, is_supported")
    .eq("code", NATIONAL_JURISDICTION_CODE)
    .maybeSingle()

  let jobJurisdictionId = requestedId
  let extractCityId = requestedId
  if (layer === "shared") {
    const nationalId = (nationalRow as { id?: string } | null)?.id
    if (!nationalId) {
      return { ok: false, error: "国の自治体マスタが見つかりません。" }
    }
    jobJurisdictionId = nationalId
    if (!extractCityId) {
      const { data: firstCity } = await op.service
        .from("rule_jurisdictions")
        .select("id")
        .eq("level", "municipality")
        .eq("is_supported", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle()
      extractCityId = String(
        (firstCity as { id?: string } | null)?.id ?? ""
      )
    }
  }

  const { data: city, error: cityError } = await op.service
    .from("rule_jurisdictions")
    .select("id, name, municipality_name, code, level, is_supported")
    .eq("id", extractCityId)
    .maybeSingle()
  if (cityError) return { ok: false, error: toUserErrorMessage(cityError) }
  if (!city) {
    return { ok: false, error: "対象の自治体が見つかりません。" }
  }
  if (
    layer === "city" &&
    (city.level !== "municipality" || !city.is_supported)
  ) {
    return { ok: false, error: "対象の自治体が見つかりません。" }
  }

  const { data: domainRows, error: domainError } = await op.service
    .from("rule_domains")
    .select("*")
    .order("sort_order", { ascending: true })
  if (domainError) return { ok: false, error: toUserErrorMessage(domainError) }

  const allDomains = (domainRows ?? []).map((r) =>
    asDomain(r as Record<string, unknown>)
  )
  const selected = resolveSelectedDomains(input.domainValue, allDomains)
  if ("error" in selected) return { ok: false, error: selected.error }

  const domainIds = selected.domains.map((d) => d.id)
  const jobDomainId =
    selected.all || selected.domains.length !== 1
      ? null
      : selected.domains[0]?.id ?? null

  const existingJobQuery = op.service
    .from("rulebook_compose_jobs")
    .select("id")
    .eq("service_type", serviceDef.serviceType)
    .eq("jurisdiction_id", jobJurisdictionId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)

  const { data: openJobs } = jobDomainId
    ? await existingJobQuery.eq("domain_id", jobDomainId)
    : await existingJobQuery.is("domain_id", null)

  const openId = (openJobs?.[0] as { id?: string } | undefined)?.id ?? null
  if (openId) {
    const { data: noteRow } = await op.service
      .from("rulebook_compose_jobs")
      .select("extraction_notes")
      .eq("id", openId)
      .maybeSingle()
    const existingNotes = parseExtractionNotes(
      (noteRow as { extraction_notes?: unknown } | null)?.extraction_notes
    )
    if (existingNotes.length > 0) {
      return { ok: true, data: { jobId: openId, sourceNote: null } }
    }
    await discardStaleComposeDraft(op.service, openId)
  }

  const { data: job, error: jobError } = await op.service
    .from("rulebook_compose_jobs")
    .insert({
      service_type: serviceDef.serviceType,
      domain_id: jobDomainId,
      domain_ids: domainIds,
      jurisdiction_id: jobJurisdictionId,
      status: "draft",
      created_by: op.userId,
    })
    .select("id")
    .single()

  if (jobError || !job) {
    return { ok: false, error: toUserErrorMessage(jobError) }
  }

  const auditRes = await ensureAuditItemOptions(op.service)
  if (!auditRes.ok || auditRes.data.length === 0) {
    return {
      ok: false,
      error: auditRes.ok
        ? "判定ルールの土台を用意できませんでした。"
        : auditRes.error,
    }
  }
  const auditItemId = auditRes.data[0].id
  const existingRules = await loadScopedRules(
    op.service,
    layer === "shared" ? jobJurisdictionId : extractCityId
  )
  const pickedIds = new Set<string>()
  const cityName = String(city.municipality_name || city.name || "")
  const phase1 = PHASE1_CITIES.find(
    (c) => c.name === cityName || c.code === String(city.code ?? "")
  )

  const extracted = await attachOfficialSourceRules({
    service: op.service,
    jobId: job.id as string,
    cityName,
    prefectureName: phase1?.prefectureName ?? "神奈川県",
    cityJurisdictionId: extractCityId,
    citySlug: phase1?.slug,
    serviceLabel: serviceDef.label,
    domains: selected.domains,
    existingRules,
    pickedIds,
    auditItemId,
    auditItems: auditRes.data,
    onlyLayers:
      layer === "shared" ? ["national", "prefecture"] : ["city"],
  })

  const notes = [...extracted.notes]
  if (layer === "shared" && !extracted.sharedHasText) {
    await fillTemplateGaps({
      service: op.service,
      jobId: job.id as string,
      domains: selected.domains,
      existingRules,
      pickedIds,
      auditItemId,
    })
    for (const note of notes) {
      if (
        (note.layer === "national" || note.layer === "prefecture") &&
        (note.status === "no_sources" || note.status === "no_text")
      ) {
        note.status = "gap_filled"
        note.message = `${note.message} 書類と見比べる標準の観点で穴埋めしました。`
      }
    }
  }

  await attachLeftoverGoodRules({
    service: op.service,
    jobId: job.id as string,
    domains: selected.domains,
    existingRules,
    pickedIds,
  })

  await saveExtractionNotes(op.service, job.id as string, notes)
  const sourceNote = summarizeExtractionNotes(notes)

  revalidateCompose(input.serviceSlug)
  return { ok: true, data: { jobId: job.id as string, sourceNote } }
}

export async function getComposeJobAction(input: {
  jobId: string
}): Promise<ActionResult<ComposeJobView>> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const jobId = input.jobId.trim()
  if (!jobId) return { ok: false, error: "下書きが指定されていません。" }

  const { data: jobRow, error: jobError } = await op.service
    .from("rulebook_compose_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle()
  if (jobError) return { ok: false, error: toUserErrorMessage(jobError) }
  if (!jobRow) return { ok: false, error: "下書きが見つかりません。" }

  const job = jobRow as RulebookComposeJob

  const [itemsRes, domainsRes, jurisRes] = await Promise.all([
    op.service
      .from("rulebook_compose_items")
      .select(
        `
        *,
        ai_check_rules (
          id, code, title, status, scope_kind, jurisdiction_id, domain_id
        )
      `
      )
      .eq("job_id", jobId)
      .order("created_at", { ascending: true }),
    op.service.from("rule_domains").select("*"),
    op.service
      .from("rule_jurisdictions")
      .select("id, name, municipality_name, code, level")
      .eq("id", job.jurisdiction_id)
      .maybeSingle(),
  ])

  if (itemsRes.error) {
    return { ok: false, error: toUserErrorMessage(itemsRes.error) }
  }
  if (domainsRes.error) {
    return { ok: false, error: toUserErrorMessage(domainsRes.error) }
  }

  const domains = (domainsRes.data ?? []).map((r) =>
    asDomain(r as Record<string, unknown>)
  )
  const domainById = new Map(domains.map((d) => [d.id, d]))

  const ruleIds = ((itemsRes.data ?? []) as Array<Record<string, unknown>>)
    .map((r) => String(r.rule_id))
    .filter(Boolean)

  const versionsByRule = new Map<string, AiCheckRuleVersion>()
  if (ruleIds.length > 0) {
    const { data: versions } = await op.service
      .from("ai_check_rule_versions")
      .select(
        "id, rule_id, version_no, guidance_text, severity, effective_from, review_status, change_summary"
      )
      .in("rule_id", ruleIds)
      .order("version_no", { ascending: false })
    for (const ver of (versions ?? []) as AiCheckRuleVersion[]) {
      if (!versionsByRule.has(ver.rule_id)) {
        versionsByRule.set(ver.rule_id, ver)
      }
    }
  }

  const items: ComposeJobItemView[] = (
    (itemsRes.data ?? []) as Array<Record<string, unknown>>
  ).map((row) => {
    const ruleRaw = row.ai_check_rules
    const rule = (
      Array.isArray(ruleRaw) ? ruleRaw[0] : ruleRaw
    ) as ComposeJobItemView["rule"]
    const domainId = (row.domain_id as string | null) ?? rule?.domain_id ?? null
    return {
      id: String(row.id),
      job_id: String(row.job_id),
      rule_id: String(row.rule_id),
      domain_id: domainId,
      origin: (row.origin as RulebookComposeItem["origin"]) ?? "existing",
      included: row.included !== false,
      created_at: String(row.created_at ?? ""),
      rule,
      version: versionsByRule.get(String(row.rule_id)) ?? null,
      domainTitle: domainId ? domainById.get(domainId)?.title ?? null : null,
    }
  })

  const juris = jurisRes.data as Pick<
    RuleJurisdiction,
    "name" | "municipality_name" | "code" | "level"
  > | null
  const isSharedJob =
    juris?.level === "national" ||
    String(juris?.code ?? "") === NATIONAL_JURISDICTION_CODE
  const cityName = isSharedJob
    ? "国・県"
    : String(juris?.municipality_name || juris?.name || "")
  const citySlug = isSharedJob
    ? null
    : getPhase1CityBySlug(
        PHASE1_CITIES.find(
          (c) => c.name === cityName || c.code === String(juris?.code ?? "")
        )?.slug ?? ""
      )?.slug ??
      PHASE1_CITIES.find((c) => c.name === cityName)?.slug ??
      null

  const serviceLabel =
    job.service_type === "訪問介護"
      ? "訪問介護"
      : job.service_type === "通所介護"
        ? "通所介護"
        : String(job.service_type)

  const domainLabel = job.domain_id
    ? domainById.get(job.domain_id)?.title ?? "領域"
    : "全て"

  const included = items.filter((i) => i.included)
  const pendingCount = included.filter(
    (i) => i.version?.review_status === "pending_review"
  ).length
  const cityCount = included.filter(
    (i) => i.origin === "city_pdf" || i.rule?.scope_kind === "city"
  ).length
  const sharedCount = included.length - cityCount

  return {
    ok: true,
    data: {
      job,
      serviceLabel,
      cityName,
      citySlug,
      layer: isSharedJob ? "shared" : "city",
      domainLabel,
      domains,
      items,
      includedCount: included.length,
      pendingCount,
      cityCount,
      sharedCount,
      extractionNotes: parseExtractionNotes(job.extraction_notes),
    },
  }
}

export async function setComposeItemIncludedAction(input: {
  itemId: string
  included: boolean
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const itemId = input.itemId.trim()
  if (!itemId) return { ok: false, error: "対象が指定されていません。" }

  const { data: item, error: fetchError } = await op.service
    .from("rulebook_compose_items")
    .select("id, job_id, rule_id, origin, included")
    .eq("id", itemId)
    .maybeSingle()
  if (fetchError) return { ok: false, error: toUserErrorMessage(fetchError) }
  if (!item) return { ok: false, error: "対象が見つかりません。" }

  const { data: job } = await op.service
    .from("rulebook_compose_jobs")
    .select("id, status")
    .eq("id", item.job_id)
    .maybeSingle()
  if (!job || job.status !== "draft") {
    return { ok: false, error: "確定済みの下書きは変更できません。" }
  }

  if (
    !input.included &&
    (item.origin === "template" ||
      item.origin === "city_pdf" ||
      item.origin === "official")
  ) {
    const { data: version } = await op.service
      .from("ai_check_rule_versions")
      .select("id, review_status")
      .eq("rule_id", item.rule_id)
      .eq("review_status", "pending_review")
      .maybeSingle()
    if (version) {
      await op.service
        .from("rulebook_compose_items")
        .delete()
        .eq("id", itemId)
      await op.service
        .from("ai_check_rule_versions")
        .delete()
        .eq("id", version.id)
      const { count } = await op.service
        .from("ai_check_rule_versions")
        .select("id", { count: "exact", head: true })
        .eq("rule_id", item.rule_id)
      if ((count ?? 0) === 0) {
        await op.service.from("ai_check_rules").delete().eq("id", item.rule_id)
      }
      revalidateCompose()
      return { ok: true }
    }
  }

  const { error } = await op.service
    .from("rulebook_compose_items")
    .update({ included: input.included })
    .eq("id", itemId)
  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateCompose()
  return { ok: true }
}

export async function addComposeManualRuleAction(input: {
  jobId: string
  title: string
  guidanceText: string
  severity: FindingSeverity
  domainId?: string | null
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const jobId = input.jobId.trim()
  const title = input.title.trim()
  const guidanceText = input.guidanceText.trim()
  if (!jobId) return { ok: false, error: "下書きが指定されていません。" }
  if (!title) return { ok: false, error: "ルール名を入力してください。" }
  if (!guidanceText) {
    return { ok: false, error: "ルールを入力してください。" }
  }

  const { data: job, error: jobError } = await op.service
    .from("rulebook_compose_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle()
  if (jobError) return { ok: false, error: toUserErrorMessage(jobError) }
  if (!job || job.status !== "draft") {
    return { ok: false, error: "この下書きには追加できません。" }
  }

  const { data: juris } = await op.service
    .from("rule_jurisdictions")
    .select("code, municipality_name, name, level")
    .eq("id", job.jurisdiction_id)
    .maybeSingle()
  const isSharedJob =
    String((juris as { level?: string } | null)?.level) === "national" ||
    String(juris?.code ?? "") === NATIONAL_JURISDICTION_CODE
  const slug = isSharedJob
    ? undefined
    : PHASE1_CITIES.find(
        (c) =>
          c.name === String(juris?.municipality_name || juris?.name || "") ||
          c.code === String(juris?.code ?? "")
      )?.slug

  const domainId =
    input.domainId?.trim() ||
    (job.domain_id as string | null) ||
    (Array.isArray(job.domain_ids) ? (job.domain_ids[0] as string) : null)

  const auditRes = await ensureAuditItemOptions(op.service)
  if (!auditRes.ok || auditRes.data.length === 0) {
    return {
      ok: false,
      error: auditRes.ok
        ? "判定ルールの土台を用意できませんでした。"
        : auditRes.error,
    }
  }

  const code = await allocateAiCheckRuleCode(op.service, {
    scopeKind: isSharedJob ? "shared" : "city",
    citySlug: slug,
  })

  const { data: rule, error: ruleError } = await op.service
    .from("ai_check_rules")
    .insert({
      audit_item_id: auditRes.data[0].id,
      code,
      title,
      target_doc_types: ["その他"],
      status: "active",
      scope_kind: isSharedJob ? "shared" : "city",
      jurisdiction_id: isSharedJob ? null : job.jurisdiction_id,
      domain_id: domainId,
    })
    .select("id")
    .single()
  if (ruleError || !rule) {
    return { ok: false, error: toUserErrorMessage(ruleError) }
  }

  const { error: verError } = await op.service
    .from("ai_check_rule_versions")
    .insert({
      rule_id: rule.id,
      version_no: 1,
      check_logic: { type: "manual", notes: guidanceText },
      guidance_text: guidanceText,
      severity: input.severity,
      effective_from: defaultEffectiveFrom(),
      review_status: "pending_review",
      change_summary: "ルールブック下書きへの手入力",
    })
  if (verError) return { ok: false, error: toUserErrorMessage(verError) }

  const { error: itemError } = await op.service
    .from("rulebook_compose_items")
    .insert({
      job_id: jobId,
      rule_id: rule.id,
      domain_id: domainId,
      origin: "manual",
      included: true,
    })
  if (itemError) return { ok: false, error: toUserErrorMessage(itemError) }

  revalidateCompose()
  return { ok: true }
}

export async function confirmComposeJobAction(input: {
  jobId: string
  note?: string
  /** 確定前に残す、承認待ち本文の修正 */
  guidanceUpdates?: { versionId: string; guidanceText: string }[]
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const jobId = input.jobId.trim()
  if (!jobId) return { ok: false, error: "下書きが指定されていません。" }

  const loaded = await getComposeJobAction({ jobId })
  if (!loaded.ok || !loaded.data) {
    return { ok: false, error: loaded.error }
  }
  if (loaded.data.job.status !== "draft") {
    return { ok: false, error: "この下書きはすでに確定または破棄されています。" }
  }

  const pendingItems = loaded.data.items.filter(
    (i) =>
      i.included &&
      i.version?.id &&
      i.version.review_status === "pending_review"
  )
  const pendingByVersionId = new Map(
    pendingItems.map((i) => [i.version!.id, i])
  )

  for (const update of input.guidanceUpdates ?? []) {
    const versionId = update.versionId.trim()
    const guidanceText = update.guidanceText.trim()
    if (!versionId) {
      return { ok: false, error: "直すルールが指定されていません。" }
    }
    if (!guidanceText) {
      return { ok: false, error: "ルールを入力してください。" }
    }
    const item = pendingByVersionId.get(versionId)
    if (!item?.version) {
      return {
        ok: false,
        error: "この下書きの承認待ちルールだけを直せます。",
      }
    }
    const { data: existing, error: fetchError } = await op.service
      .from("ai_check_rule_versions")
      .select("id, check_logic, review_status")
      .eq("id", versionId)
      .maybeSingle()
    if (fetchError) return { ok: false, error: toUserErrorMessage(fetchError) }
    if (!existing || existing.review_status !== "pending_review") {
      return {
        ok: false,
        error: "この下書きの承認待ちルールだけを直せます。",
      }
    }
    const prevLogic =
      existing.check_logic && typeof existing.check_logic === "object"
        ? (existing.check_logic as Record<string, unknown>)
        : {}
    const { error: guidanceError } = await op.service
      .from("ai_check_rule_versions")
      .update({
        guidance_text: guidanceText,
        check_logic: { ...prevLogic, notes: guidanceText },
      })
      .eq("id", versionId)
      .eq("review_status", "pending_review")
    if (guidanceError) {
      return { ok: false, error: toUserErrorMessage(guidanceError) }
    }
  }

  const reason =
    input.note?.trim() ||
    "内容を確認し、このルールブックを確定します。"

  for (const item of pendingItems) {
    if (!item.version) continue
    const { error } = await op.service
      .from("ai_check_rule_versions")
      .update({
        review_status: "approved",
        reviewed_by: op.userId,
        reviewed_at: new Date().toISOString(),
        review_reason: reason,
      })
      .eq("id", item.version.id)
      .eq("review_status", "pending_review")
    if (error) return { ok: false, error: toUserErrorMessage(error) }
  }

  const includedIds = new Set(
    loaded.data.items.filter((i) => i.included).map((i) => i.rule_id)
  )
  if (loaded.data.layer === "shared") {
    const existingRules = await loadScopedRules(
      op.service,
      loaded.data.job.jurisdiction_id
    )
    for (const rule of existingRules) {
      if (rule.scopeKind === "city") continue
      if (includedIds.has(rule.id)) continue
      if (!isThinComposeGuidance(rule.guidanceText)) continue
      await op.service
        .from("ai_check_rules")
        .update({ status: "retired" })
        .eq("id", rule.id)
        .eq("status", "active")
    }
  }

  const { error } = await op.service
    .from("rulebook_compose_jobs")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: op.userId,
    })
    .eq("id", jobId)
    .eq("status", "draft")
  if (error) return { ok: false, error: toUserErrorMessage(error) }

  revalidateCompose()
  revalidatePath("/admin/rules/pending")
  revalidatePath("/admin/rules/ai-rules")
  return { ok: true }
}

export async function discardComposeJobAction(input: {
  jobId: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const jobId = input.jobId.trim()
  if (!jobId) return { ok: false, error: "下書きが指定されていません。" }

  const { data: job, error: fetchError } = await op.service
    .from("rulebook_compose_jobs")
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle()
  if (fetchError) return { ok: false, error: toUserErrorMessage(fetchError) }
  if (!job) return { ok: false, error: "下書きが見つかりません。" }
  if (job.status !== "draft") {
    return { ok: false, error: "この下書きは破棄できません。" }
  }

  const { data: items } = await op.service
    .from("rulebook_compose_items")
    .select("id, rule_id, origin")
    .eq("job_id", jobId)

  for (const item of items ?? []) {
    if (
      item.origin !== "template" &&
      item.origin !== "manual" &&
      item.origin !== "city_pdf" &&
      item.origin !== "official"
    ) {
      continue
    }
    const { data: version } = await op.service
      .from("ai_check_rule_versions")
      .select("id")
      .eq("rule_id", item.rule_id)
      .eq("review_status", "pending_review")
      .maybeSingle()
    if (!version) continue
    await op.service.from("ai_check_rule_versions").delete().eq("id", version.id)
    const { count } = await op.service
      .from("ai_check_rule_versions")
      .select("id", { count: "exact", head: true })
      .eq("rule_id", item.rule_id)
    if ((count ?? 0) === 0) {
      await op.service.from("ai_check_rules").delete().eq("id", item.rule_id)
    }
  }

  const { error } = await op.service
    .from("rulebook_compose_jobs")
    .update({ status: "discarded" })
    .eq("id", jobId)
  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateCompose()
  return { ok: true }
}

export async function retireComposeRuleAction(input: {
  ruleId: string
  itemId: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const ruleId = input.ruleId.trim()
  const itemId = input.itemId.trim()
  if (!ruleId) return { ok: false, error: "対象ルールが指定されていません。" }

  const { error } = await op.service
    .from("ai_check_rules")
    .update({ status: "retired" })
    .eq("id", ruleId)
  if (error) return { ok: false, error: toUserErrorMessage(error) }

  if (itemId) {
    await op.service
      .from("rulebook_compose_items")
      .update({ included: false })
      .eq("id", itemId)
  }
  revalidateCompose()
  return { ok: true }
}

export async function updateComposeItemGuidanceAction(input: {
  versionId: string
  guidanceText: string
  severity: FindingSeverity
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const versionId = input.versionId.trim()
  const guidanceText = input.guidanceText.trim()
  if (!versionId) return { ok: false, error: "対象が指定されていません。" }
  if (!guidanceText) return { ok: false, error: "ルールを入力してください。" }

  const { data: existing, error: fetchError } = await op.service
    .from("ai_check_rule_versions")
    .select("id, check_logic, review_status, effective_from")
    .eq("id", versionId)
    .maybeSingle()
  if (fetchError) return { ok: false, error: toUserErrorMessage(fetchError) }
  if (!existing) return { ok: false, error: "対象の版が見つかりません。" }
  if (existing.review_status === "approved") {
    return {
      ok: false,
      error:
        "確定済みのルールは、ここでは直接直せません。下書きから外すか、判定ルール管理で修正案を出してください。",
    }
  }

  const prevLogic =
    existing.check_logic && typeof existing.check_logic === "object"
      ? (existing.check_logic as Record<string, unknown>)
      : {}

  const { error } = await op.service
    .from("ai_check_rule_versions")
    .update({
      guidance_text: guidanceText,
      severity: input.severity,
      check_logic: { ...prevLogic, notes: guidanceText },
    })
    .eq("id", versionId)
  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateCompose()
  return { ok: true }
}
