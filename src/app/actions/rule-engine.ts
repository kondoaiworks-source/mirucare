"use server"

import { revalidatePath } from "next/cache"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import { HOME_VISIT_AUDIT_TEMPLATE_ITEMS } from "@/lib/rule-engine/home-visit-audit-template"
import type {
  AiCheckRule,
  AiCheckRuleVersion,
  AuditItem,
  AuditItemCategory,
  FindingSeverity,
  KnowledgeDocumentChangeDraft,
  KnowledgeDocument,
  KnowledgeSyncAlert,
  RuleHumanReviewStatus,
  RuleJurisdiction,
  RuleMaterialCategory,
  RuleSet,
  RuleSource,
  RuleSourceFileType,
  RuleSourceKind,
  RuleSourceStatus,
  ServiceType,
} from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

function revalidateRules(path?: string) {
  revalidatePath("/admin/rules")
  if (path) revalidatePath(path)
}

export async function getRulesDashboardAction(): Promise<
  ActionResult<{
    jurisdictionCount: number
    supportedMunicipalityCount: number
    ruleSetCount: number
    auditItemCount: number
    additionItemCount: number
    aiRuleCount: number
    approvedAiRuleCount: number
    pendingVersionCount: number
    openSyncAlertCount: number
    pendingKnowledgeDraftCount: number
    knowledgeDocumentCount: number
    sourceUrlCount: number
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const [
    jurisdictions,
    supported,
    sets,
    items,
    additions,
    rules,
    approvedRules,
    pendingVersions,
    alerts,
    drafts,
    documents,
    sourceUrls,
  ] = await Promise.all([
    op.service
      .from("rule_jurisdictions")
      .select("id", { count: "exact", head: true }),
    op.service
      .from("rule_jurisdictions")
      .select("id", { count: "exact", head: true })
      .eq("level", "municipality")
      .eq("is_supported", true),
    op.service.from("rule_sets").select("id", { count: "exact", head: true }),
    op.service.from("audit_items").select("id", { count: "exact", head: true }),
    op.service
      .from("audit_items")
      .select("id", { count: "exact", head: true })
      .eq("category", "加算"),
    op.service
      .from("ai_check_rules")
      .select("id", { count: "exact", head: true }),
    op.service
      .from("ai_check_rule_versions")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "approved"),
    op.service
      .from("ai_check_rule_versions")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "pending_review"),
    op.service
      .from("knowledge_sync_alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    op.service
      .from("knowledge_document_change_drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    op.service
      .from("knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    op.service
      .from("rule_sources")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ])

  const firstError =
    jurisdictions.error ||
    supported.error ||
    sets.error ||
    items.error ||
    additions.error ||
    rules.error ||
    approvedRules.error ||
    pendingVersions.error ||
    alerts.error ||
    drafts.error ||
    documents.error ||
    sourceUrls.error

  if (firstError) {
    return {
      ok: false,
      error:
        toUserErrorMessage(firstError) ||
        "集計に失敗しました。マイグレーション適用をご確認ください。",
    }
  }

  return {
    ok: true,
    data: {
      jurisdictionCount: jurisdictions.count ?? 0,
      supportedMunicipalityCount: supported.count ?? 0,
      ruleSetCount: sets.count ?? 0,
      auditItemCount: items.count ?? 0,
      additionItemCount: additions.count ?? 0,
      aiRuleCount: rules.count ?? 0,
      approvedAiRuleCount: approvedRules.count ?? 0,
      pendingVersionCount: pendingVersions.count ?? 0,
      openSyncAlertCount: alerts.count ?? 0,
      pendingKnowledgeDraftCount: drafts.count ?? 0,
      knowledgeDocumentCount: documents.count ?? 0,
      sourceUrlCount: sourceUrls.count ?? 0,
    },
  }
}

export async function listJurisdictionsAction(): Promise<
  ActionResult<{ rows: RuleJurisdiction[] }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { data, error } = await op.service
    .from("rule_jurisdictions")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true })

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  return { ok: true, data: { rows: (data ?? []) as RuleJurisdiction[] } }
}

export async function setJurisdictionSupportedAction(input: {
  id: string
  isSupported: boolean
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { error } = await op.service
    .from("rule_jurisdictions")
    .update({ is_supported: input.isSupported })
    .eq("id", input.id)

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateRules("/admin/rules/municipalities")
  return { ok: true }
}

export async function listRuleSourcesAction(): Promise<
  ActionResult<{
    rows: Array<
      RuleSource & {
        rule_jurisdictions: Pick<RuleJurisdiction, "id" | "name" | "code"> | null
      }
    >
    jurisdictions: RuleJurisdiction[]
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const [sources, jurisdictions] = await Promise.all([
    op.service
      .from("rule_sources")
      .select(
        `
        *,
        rule_jurisdictions ( id, name, code )
      `
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    op.service
      .from("rule_jurisdictions")
      .select("*")
      .order("sort_order", { ascending: true }),
  ])

  if (sources.error) {
    return { ok: false, error: toUserErrorMessage(sources.error) }
  }
  if (jurisdictions.error) {
    return { ok: false, error: toUserErrorMessage(jurisdictions.error) }
  }

  const rows = (sources.data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const j = r.rule_jurisdictions
    return {
      ...(row as RuleSource),
      rule_jurisdictions: (Array.isArray(j) ? j[0] : j) as
        | Pick<RuleJurisdiction, "id" | "name" | "code">
        | null,
    }
  })

  return {
    ok: true,
    data: {
      rows,
      jurisdictions: (jurisdictions.data ?? []) as RuleJurisdiction[],
    },
  }
}

export async function createRuleSourceAction(input: {
  jurisdictionId: string
  title: string
  sourceKind: RuleSourceKind
  officialUrl?: string
  publishedOn?: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const title = input.title.trim()
  if (!title) return { ok: false, error: "名称を入力してください。" }
  if (!input.jurisdictionId) {
    return { ok: false, error: "管轄を選択してください。" }
  }

  const { error } = await op.service.from("rule_sources").insert({
    jurisdiction_id: input.jurisdictionId,
    title,
    source_kind: input.sourceKind,
    official_url: input.officialUrl?.trim() || null,
    published_on: input.publishedOn?.trim() || null,
    status: "active",
  })

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateRules("/admin/rules/laws")
  revalidateRules("/admin/rules/source-urls")
  return { ok: true }
}

export type RuleSourceRow = RuleSource & {
  rule_jurisdictions: Pick<
    RuleJurisdiction,
    "id" | "name" | "code" | "municipality_name" | "level"
  > | null
}

export async function listMunicipalitySourceUrlsAction(opts?: {
  jurisdictionId?: string
  materialCategory?: RuleMaterialCategory | "all"
  status?: RuleSourceStatus | "all"
  humanReviewStatus?: RuleHumanReviewStatus | "all"
}): Promise<
  ActionResult<{
    rows: RuleSourceRow[]
    municipalities: RuleJurisdiction[]
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  let query = op.service
    .from("rule_sources")
    .select(
      `
      *,
      rule_jurisdictions ( id, name, code, municipality_name, level )
    `
    )
    .not("material_category", "is", null)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(500)

  if (opts?.jurisdictionId) {
    query = query.eq("jurisdiction_id", opts.jurisdictionId)
  }
  if (opts?.materialCategory && opts.materialCategory !== "all") {
    query = query.eq("material_category", opts.materialCategory)
  }
  if (opts?.status && opts.status !== "all") {
    query = query.eq("status", opts.status)
  }
  if (opts?.humanReviewStatus && opts.humanReviewStatus !== "all") {
    query = query.eq("human_review_status", opts.humanReviewStatus)
  }

  const [sources, municipalities] = await Promise.all([
    query,
    op.service
      .from("rule_jurisdictions")
      .select("*")
      .eq("level", "municipality")
      .eq("is_supported", true)
      .order("sort_order", { ascending: true }),
  ])

  if (sources.error) {
    return { ok: false, error: toUserErrorMessage(sources.error) }
  }
  if (municipalities.error) {
    return { ok: false, error: toUserErrorMessage(municipalities.error) }
  }

  const rows = (sources.data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const j = r.rule_jurisdictions
    return {
      ...(row as RuleSource),
      rule_jurisdictions: (Array.isArray(j) ? j[0] : j) as RuleSourceRow["rule_jurisdictions"],
    }
  })

  return {
    ok: true,
    data: {
      rows,
      municipalities: (municipalities.data ?? []) as RuleJurisdiction[],
    },
  }
}

export async function updateRuleSourceUrlAction(input: {
  id: string
  title?: string
  serviceType?: ServiceType
  materialCategory?: RuleMaterialCategory
  sourceKind?: RuleSourceKind
  parentPageUrl?: string
  directFileUrl?: string
  priority?: number
  sourceLastUpdatedOn?: string
  fileType?: RuleSourceFileType | ""
  contentHash?: string
  status?: RuleSourceStatus
  humanReviewStatus?: RuleHumanReviewStatus
  memo?: string
  markVerified?: boolean
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  if (!input.id) return { ok: false, error: "対象が指定されていません。" }

  const patch: Record<string, unknown> = {}

  if (input.title !== undefined) {
    const title = input.title.trim()
    if (!title) return { ok: false, error: "資料名を入力してください。" }
    patch.title = title
  }
  if (input.serviceType !== undefined) patch.service_type = input.serviceType
  if (input.materialCategory !== undefined) {
    patch.material_category = input.materialCategory
  }
  if (input.sourceKind !== undefined) patch.source_kind = input.sourceKind
  if (input.parentPageUrl !== undefined) {
    patch.parent_page_url = input.parentPageUrl.trim() || null
  }
  if (input.directFileUrl !== undefined) {
    patch.direct_file_url = input.directFileUrl.trim() || null
  }
  if (input.priority !== undefined) {
    if (input.priority < 1 || input.priority > 999) {
      return { ok: false, error: "優先度は 1〜999 で入力してください。" }
    }
    patch.priority = input.priority
  }
  if (input.sourceLastUpdatedOn !== undefined) {
    patch.source_last_updated_on = input.sourceLastUpdatedOn.trim() || null
  }
  if (input.fileType !== undefined) {
    patch.file_type = input.fileType || null
  }
  if (input.contentHash !== undefined) {
    patch.content_hash = input.contentHash.trim() || null
  }
  if (input.status !== undefined) patch.status = input.status
  if (input.humanReviewStatus !== undefined) {
    patch.human_review_status = input.humanReviewStatus
  }
  if (input.memo !== undefined) patch.memo = input.memo.trim() || null
  if (input.markVerified) {
    patch.last_verified_at = new Date().toISOString()
    patch.human_review_status = "verified"
  }

  if (
    input.parentPageUrl !== undefined ||
    input.directFileUrl !== undefined
  ) {
    const parent =
      input.parentPageUrl !== undefined
        ? input.parentPageUrl.trim() || null
        : undefined
    const direct =
      input.directFileUrl !== undefined
        ? input.directFileUrl.trim() || null
        : undefined

    if (parent !== undefined || direct !== undefined) {
      const { data: current } = await op.service
        .from("rule_sources")
        .select("parent_page_url, direct_file_url")
        .eq("id", input.id)
        .maybeSingle()

      const nextParent =
        parent !== undefined ? parent : (current?.parent_page_url ?? null)
      const nextDirect =
        direct !== undefined ? direct : (current?.direct_file_url ?? null)
      patch.official_url = nextDirect || nextParent || null
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "更新する項目がありません。" }
  }

  const { error } = await op.service
    .from("rule_sources")
    .update(patch)
    .eq("id", input.id)

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateRules("/admin/rules/source-urls")
  revalidateRules("/admin/rules/laws")
  return { ok: true }
}

export async function createMunicipalitySourceUrlAction(input: {
  jurisdictionId: string
  title: string
  serviceType: ServiceType
  materialCategory: RuleMaterialCategory
  sourceKind?: RuleSourceKind
  parentPageUrl?: string
  directFileUrl?: string
  priority?: number
  fileType?: RuleSourceFileType | ""
  memo?: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const title = input.title.trim()
  if (!title) return { ok: false, error: "資料名を入力してください。" }
  if (!input.jurisdictionId) {
    return { ok: false, error: "自治体を選択してください。" }
  }
  if (!input.materialCategory) {
    return { ok: false, error: "資料カテゴリを選択してください。" }
  }

  const parent = input.parentPageUrl?.trim() || null
  const direct = input.directFileUrl?.trim() || null

  const { error } = await op.service.from("rule_sources").insert({
    jurisdiction_id: input.jurisdictionId,
    title,
    service_type: input.serviceType,
    material_category: input.materialCategory,
    source_kind: input.sourceKind ?? "manual",
    parent_page_url: parent,
    direct_file_url: direct,
    official_url: direct || parent,
    priority: input.priority ?? 100,
    file_type: input.fileType || null,
    memo: input.memo?.trim() || null,
    status: "active",
    human_review_status: "unverified",
  })

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateRules("/admin/rules/source-urls")
  return { ok: true }
}

export async function listRuleSetsAction(): Promise<
  ActionResult<{
    rows: Array<
      RuleSet & {
        rule_jurisdictions: Pick<RuleJurisdiction, "id" | "name" | "code"> | null
      }
    >
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { data, error } = await op.service
    .from("rule_sets")
    .select(
      `
      *,
      rule_jurisdictions ( id, name, code )
    `
    )
    .order("updated_at", { ascending: false })

  if (error) return { ok: false, error: toUserErrorMessage(error) }

  const rows = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const j = r.rule_jurisdictions
    return {
      ...(row as RuleSet),
      rule_jurisdictions: (Array.isArray(j) ? j[0] : j) as
        | Pick<RuleJurisdiction, "id" | "name" | "code">
        | null,
    }
  })

  return { ok: true, data: { rows } }
}

export async function listAuditItemsAction(opts?: {
  category?: AuditItemCategory
}): Promise<
  ActionResult<{
    rows: Array<
      AuditItem & {
        rule_sets: Pick<RuleSet, "id" | "title" | "service_type"> | null
      }
    >
    ruleSets: Array<
      RuleSet & {
        rule_jurisdictions: Pick<RuleJurisdiction, "name"> | null
      }
    >
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  let itemsQuery = op.service
    .from("audit_items")
    .select(
      `
      *,
      rule_sets ( id, title, service_type )
    `
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(300)

  if (opts?.category) {
    itemsQuery = itemsQuery.eq("category", opts.category)
  }

  const [items, sets] = await Promise.all([
    itemsQuery,
    op.service
      .from("rule_sets")
      .select(
        `
        *,
        rule_jurisdictions ( name )
      `
      )
      .order("title", { ascending: true }),
  ])

  if (items.error) return { ok: false, error: toUserErrorMessage(items.error) }
  if (sets.error) return { ok: false, error: toUserErrorMessage(sets.error) }

  const rows = (items.data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const s = r.rule_sets
    return {
      ...(row as AuditItem),
      rule_sets: (Array.isArray(s) ? s[0] : s) as
        | Pick<RuleSet, "id" | "title" | "service_type">
        | null,
    }
  })

  const ruleSets = (sets.data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const j = r.rule_jurisdictions
    return {
      ...(row as RuleSet),
      rule_jurisdictions: (Array.isArray(j) ? j[0] : j) as
        | Pick<RuleJurisdiction, "name">
        | null,
    }
  })

  return { ok: true, data: { rows, ruleSets } }
}

export async function createAuditItemAction(input: {
  ruleSetId: string
  code: string
  title: string
  description?: string
  category: AuditItemCategory
  riskLevel: FindingSeverity
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const title = input.title.trim()
  if (!input.ruleSetId) return { ok: false, error: "ルールセットを選んでください。" }
  if (!title) return { ok: false, error: "項目名を入力してください。" }
  const code =
    normalizeAuditItemCode(input.code) ||
    createFallbackAuditItemCode(input.category)

  const { error } = await op.service.from("audit_items").insert({
    rule_set_id: input.ruleSetId,
    code,
    title,
    description: input.description?.trim() || "",
    category: input.category,
    risk_level: input.riskLevel,
    status: "active",
  })

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateRules("/admin/rules/audit-items")
  revalidateRules("/admin/rules/additions")
  return { ok: true }
}

const AUDIT_ITEM_CODE_PREFIX: Record<AuditItemCategory, string> = {
  契約: "CONTRACT",
  計画: "PLAN",
  記録: "RECORD",
  人員: "STAFF",
  加算: "ADD",
  請求: "BILLING",
  その他: "OTHER",
}

function normalizeAuditItemCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
}

function createFallbackAuditItemCode(category: AuditItemCategory) {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 17)
  return `${AUDIT_ITEM_CODE_PREFIX[category]}_${timestamp}`
}

export async function createHomeVisitAuditTemplateAction(input: {
  ruleSetId: string
}): Promise<ActionResult<{ insertedCount: number; skippedCount: number }>> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  if (!input.ruleSetId) {
    return { ok: false, error: "ルールセットを選んでください。" }
  }

  const { data: ruleSet, error: ruleSetError } = await op.service
    .from("rule_sets")
    .select("id, service_type")
    .eq("id", input.ruleSetId)
    .maybeSingle()

  if (ruleSetError) return { ok: false, error: toUserErrorMessage(ruleSetError) }
  if (!ruleSet) return { ok: false, error: "ルールセットが見つかりません。" }
  if ((ruleSet as Pick<RuleSet, "service_type">).service_type !== "訪問介護") {
    return {
      ok: false,
      error: "訪問介護のルールセットを選んでください。",
    }
  }

  const templateCodes = HOME_VISIT_AUDIT_TEMPLATE_ITEMS.map((item) => item.code)
  const { data: existing, error: existingError } = await op.service
    .from("audit_items")
    .select("code")
    .eq("rule_set_id", input.ruleSetId)
    .in("code", templateCodes)

  if (existingError) return { ok: false, error: toUserErrorMessage(existingError) }

  const existingCodes = new Set((existing ?? []).map((row) => String(row.code)))
  const rows = HOME_VISIT_AUDIT_TEMPLATE_ITEMS.flatMap((item, index) =>
    existingCodes.has(item.code)
      ? []
      : [
          {
            rule_set_id: input.ruleSetId,
            code: item.code,
            title: item.title,
            description: item.description,
            category: item.category,
            risk_level: item.riskLevel,
            sort_order: (index + 1) * 10,
            status: "active",
          },
        ]
  )

  if (rows.length > 0) {
    const { error } = await op.service.from("audit_items").insert(rows)
    if (error) return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidateRules("/admin/rules/audit-items")
  revalidateRules("/admin/rules/additions")
  return {
    ok: true,
    data: {
      insertedCount: rows.length,
      skippedCount: HOME_VISIT_AUDIT_TEMPLATE_ITEMS.length - rows.length,
    },
  }
}

export async function listAiRulesAction(): Promise<
  ActionResult<{
    rules: Array<
      AiCheckRule & {
        audit_items: Pick<AuditItem, "id" | "title" | "code"> | null
      }
    >
    versions: AiCheckRuleVersion[]
    auditItems: AuditItem[]
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const [rules, versions, items] = await Promise.all([
    op.service
      .from("ai_check_rules")
      .select(
        `
        *,
        audit_items ( id, title, code )
      `
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    op.service
      .from("ai_check_rule_versions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    op.service
      .from("audit_items")
      .select("*")
      .eq("status", "active")
      .order("title", { ascending: true }),
  ])

  if (rules.error) return { ok: false, error: toUserErrorMessage(rules.error) }
  if (versions.error) {
    return { ok: false, error: toUserErrorMessage(versions.error) }
  }
  if (items.error) return { ok: false, error: toUserErrorMessage(items.error) }

  const mappedRules = (rules.data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const a = r.audit_items
    return {
      ...(row as AiCheckRule),
      audit_items: (Array.isArray(a) ? a[0] : a) as
        | Pick<AuditItem, "id" | "title" | "code">
        | null,
    }
  })

  return {
    ok: true,
    data: {
      rules: mappedRules,
      versions: (versions.data ?? []) as AiCheckRuleVersion[],
      auditItems: (items.data ?? []) as AuditItem[],
    },
  }
}

export async function createAiCheckRuleWithVersionAction(input: {
  auditItemId: string
  code: string
  title: string
  targetDocTypes: string[]
  guidanceText: string
  severity: FindingSeverity
  effectiveFrom: string
  changeSummary?: string
  submitForReview: boolean
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const code = input.code.trim().toUpperCase()
  const title = input.title.trim()
  if (!input.auditItemId) {
    return { ok: false, error: "監査項目を選んでください。" }
  }
  if (!code || !title) {
    return { ok: false, error: "コードと名称を入力してください。" }
  }
  if (!input.effectiveFrom) {
    return { ok: false, error: "適用開始日を入力してください。" }
  }

  const { data: rule, error: ruleError } = await op.service
    .from("ai_check_rules")
    .insert({
      audit_item_id: input.auditItemId,
      code,
      title,
      target_doc_types: input.targetDocTypes,
      status: "active",
    })
    .select("*")
    .single()

  if (ruleError || !rule) {
    return { ok: false, error: toUserErrorMessage(ruleError) }
  }

  const { error: verError } = await op.service
    .from("ai_check_rule_versions")
    .insert({
      rule_id: (rule as AiCheckRule).id,
      version_no: 1,
      check_logic: {
        type: "heuristic",
        notes: input.guidanceText.trim() || "",
      },
      guidance_text: input.guidanceText.trim() || "",
      severity: input.severity,
      effective_from: input.effectiveFrom,
      review_status: input.submitForReview ? "pending_review" : "draft",
      change_summary: input.changeSummary?.trim() || "初版",
    })

  if (verError) {
    return { ok: false, error: toUserErrorMessage(verError) }
  }

  revalidateRules("/admin/rules/ai-rules")
  revalidateRules("/admin/rules/pending")
  revalidateRules("/admin/rules/history")
  return { ok: true }
}

export async function listPendingRuleVersionsAction(): Promise<
  ActionResult<{
    rows: Array<
      AiCheckRuleVersion & {
        ai_check_rules: Pick<AiCheckRule, "id" | "title" | "code"> | null
      }
    >
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { data, error } = await op.service
    .from("ai_check_rule_versions")
    .select(
      `
      *,
      ai_check_rules ( id, title, code )
    `
    )
    .eq("review_status", "pending_review")
    .order("created_at", { ascending: false })

  if (error) return { ok: false, error: toUserErrorMessage(error) }

  const rows = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const rule = r.ai_check_rules
    return {
      ...(row as AiCheckRuleVersion),
      ai_check_rules: (Array.isArray(rule) ? rule[0] : rule) as
        | Pick<AiCheckRule, "id" | "title" | "code">
        | null,
    }
  })

  return { ok: true, data: { rows } }
}

export async function reviewAiCheckRuleVersionAction(input: {
  versionId: string
  decision: "approved" | "rejected"
  reviewReason: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const reason = input.reviewReason.trim()
  if (!reason) {
    return { ok: false, error: "確認記録（理由）を入力してください。" }
  }

  const { error } = await op.service
    .from("ai_check_rule_versions")
    .update({
      review_status: input.decision,
      reviewed_by: op.userId,
      reviewed_at: new Date().toISOString(),
      review_reason: reason,
    })
    .eq("id", input.versionId)
    .eq("review_status", "pending_review")

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateRules("/admin/rules/pending")
  revalidateRules("/admin/rules/history")
  revalidateRules("/admin/rules/ai-rules")
  return { ok: true }
}

export async function listRuleVersionHistoryAction(): Promise<
  ActionResult<{
    rows: Array<
      AiCheckRuleVersion & {
        ai_check_rules: Pick<AiCheckRule, "id" | "title" | "code"> | null
      }
    >
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { data, error } = await op.service
    .from("ai_check_rule_versions")
    .select(
      `
      *,
      ai_check_rules ( id, title, code )
    `
    )
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return { ok: false, error: toUserErrorMessage(error) }

  const rows = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const rule = r.ai_check_rules
    return {
      ...(row as AiCheckRuleVersion),
      ai_check_rules: (Array.isArray(rule) ? rule[0] : rule) as
        | Pick<AiCheckRule, "id" | "title" | "code">
        | null,
    }
  })

  return { ok: true, data: { rows } }
}

export async function listRuleNotificationsAction(): Promise<
  ActionResult<{
    drafts: Array<
      KnowledgeDocumentChangeDraft & {
        knowledge_documents: Pick<KnowledgeDocument, "id" | "title"> | null
      }
    >
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { data, error } = await op.service
    .from("knowledge_document_change_drafts")
    .select(
      `
      *,
      knowledge_documents ( id, title )
    `
    )
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { ok: false, error: toUserErrorMessage(error) }

  const drafts = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const doc = r.knowledge_documents
    return {
      ...(row as KnowledgeDocumentChangeDraft),
      knowledge_documents: (Array.isArray(doc) ? doc[0] : doc) as
        | Pick<KnowledgeDocument, "id" | "title">
        | null,
    }
  })

  return { ok: true, data: { drafts } }
}

export async function listRuleJobsAction(): Promise<
  ActionResult<{
    documents: Array<
      Pick<
        KnowledgeDocument,
        | "id"
        | "title"
        | "watch_kind"
        | "last_sync_status"
        | "last_checked_at"
        | "last_ok_at"
        | "last_error"
        | "status"
      >
    >
    alerts: KnowledgeSyncAlert[]
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const [docs, alerts] = await Promise.all([
    op.service
      .from("knowledge_documents")
      .select(
        "id, title, watch_kind, last_sync_status, last_checked_at, last_ok_at, last_error, status"
      )
      .eq("status", "active")
      .order("last_checked_at", { ascending: false })
      .limit(50),
    op.service
      .from("knowledge_sync_alerts")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(30),
  ])

  if (docs.error) return { ok: false, error: toUserErrorMessage(docs.error) }
  if (alerts.error) return { ok: false, error: toUserErrorMessage(alerts.error) }

  return {
    ok: true,
    data: {
      documents: (docs.data ?? []) as Array<
        Pick<
          KnowledgeDocument,
          | "id"
          | "title"
          | "watch_kind"
          | "last_sync_status"
          | "last_checked_at"
          | "last_ok_at"
          | "last_error"
          | "status"
        >
      >,
      alerts: (alerts.data ?? []) as KnowledgeSyncAlert[],
    },
  }
}
