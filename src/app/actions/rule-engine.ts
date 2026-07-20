"use server"

import { revalidatePath } from "next/cache"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import type {
  AiCheckRule,
  AiCheckRuleVersion,
  AuditItem,
  AuditItemCategory,
  FindingSeverity,
  KnowledgeDocumentChangeDraft,
  KnowledgeDocument,
  KnowledgeSyncAlert,
  RuleJurisdiction,
  RuleSet,
  RuleSource,
  RuleSourceKind,
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
    aiRuleCount: number
    pendingVersionCount: number
    openSyncAlertCount: number
    pendingKnowledgeDraftCount: number
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const [
    jurisdictions,
    supported,
    sets,
    items,
    rules,
    pendingVersions,
    alerts,
    drafts,
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
      .from("ai_check_rules")
      .select("id", { count: "exact", head: true }),
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
  ])

  const firstError =
    jurisdictions.error ||
    supported.error ||
    sets.error ||
    items.error ||
    rules.error ||
    pendingVersions.error ||
    alerts.error ||
    drafts.error

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
      aiRuleCount: rules.count ?? 0,
      pendingVersionCount: pendingVersions.count ?? 0,
      openSyncAlertCount: alerts.count ?? 0,
      pendingKnowledgeDraftCount: drafts.count ?? 0,
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

  const code = input.code.trim().toUpperCase()
  const title = input.title.trim()
  if (!input.ruleSetId) return { ok: false, error: "ルールセットを選んでください。" }
  if (!code) return { ok: false, error: "コードを入力してください。" }
  if (!title) return { ok: false, error: "項目名を入力してください。" }

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
