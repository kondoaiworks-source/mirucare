"use server"

import { revalidatePath } from "next/cache"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import { ensureKnowledgeDocumentFromRuleSource } from "@/lib/knowledge/ensure-from-rule-source"
import {
  getAuditCategoryBySlug,
  isAuditCategorySlug,
} from "@/lib/rule-engine/audit-categories"
import {
  pickDiscoverableSources,
  type DiscoverableSource,
} from "@/lib/rule-engine/category-pdf-discovery"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"
import {
  KANAGAWA_JURISDICTION_CODE,
  NATIONAL_JURISDICTION_CODE,
} from "@/lib/rule-engine/phase1-cities"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import type { ServiceType } from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

export type CategoryPdfCandidateRow = {
  id: string
  title: string
  parentPageUrl: string | null
  directFileUrl: string | null
  discoveryMethod: "keyword_match" | "manual" | "crawl"
  existingSourceId: string | null
  jurisdictionId: string | null
  status: "pending"
}

export type CategoryPdfAdoptedRow = {
  linkSourceId: string
  title: string
  parentPageUrl: string | null
  directFileUrl: string | null
  knowledgeDocumentId: string | null
  humanReviewStatus: string
  layerLabel: string
}

export type CategoryPdfBoard = {
  pending: CategoryPdfCandidateRow[]
  adopted: CategoryPdfAdoptedRow[]
}

function revalidateCategoryPaths() {
  revalidatePath("/admin/rules/services", "layout")
  revalidatePath("/admin/rules/services", "layout")
  revalidatePath("/admin/rules/documents")
  revalidatePath("/admin/document-changes")
}

function resolveServiceType(serviceSlug: string): ServiceType | null {
  return getRuleServiceBySlug(serviceSlug)?.serviceType ?? null
}

async function loadJurisdictionIdsForCity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  citySlug: string
): Promise<{
  cityName: string
  jurisdictionIds: string[]
  cityJurisdictionId: string | null
  codeToLabel: Map<string, string>
} | null> {
  const city = getPhase1CityBySlug(citySlug)
  if (!city) return null

  const { data: rows } = await service
    .from("rule_jurisdictions")
    .select("id, code, name")
    .in("code", [
      NATIONAL_JURISDICTION_CODE,
      KANAGAWA_JURISDICTION_CODE,
      city.code,
    ])

  const codeToLabel = new Map<string, string>()
  const jurisdictionIds: string[] = []
  let cityJurisdictionId: string | null = null

  for (const row of rows ?? []) {
    const id = row.id as string
    const code = row.code as string
    jurisdictionIds.push(id)
    if (code === NATIONAL_JURISDICTION_CODE) codeToLabel.set(id, "国")
    else if (code === KANAGAWA_JURISDICTION_CODE) {
      codeToLabel.set(id, city.prefectureName)
    } else {
      codeToLabel.set(id, city.name)
      cityJurisdictionId = id
    }
  }

  return {
    cityName: city.name,
    jurisdictionIds,
    cityJurisdictionId,
    codeToLabel,
  }
}

/**
 * カテゴリの関連PDFボード（候補＋採用済み）を取得する。
 */
export async function getCategoryPdfBoardAction(input: {
  serviceSlug: string
  citySlug: string
  categorySlug: string
}): Promise<ActionResult<CategoryPdfBoard>> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const serviceType = resolveServiceType(input.serviceSlug)
  if (!serviceType) return { ok: false, error: "サービスが見つかりません。" }
  if (!isAuditCategorySlug(input.categorySlug)) {
    return { ok: false, error: "監査カテゴリが見つかりません。" }
  }
  if (!getPhase1CityBySlug(input.citySlug)) {
    return { ok: false, error: "対象の市が見つかりません。" }
  }

  const juris = await loadJurisdictionIdsForCity(op.service, input.citySlug)
  if (!juris) return { ok: false, error: "自治体情報を取得できませんでした。" }

  const [candidatesRes, linksRes] = await Promise.all([
    op.service
      .from("rule_category_pdf_candidates")
      .select(
        "id, title, parent_page_url, direct_file_url, discovery_method, existing_source_id, jurisdiction_id, status"
      )
      .eq("service_type", serviceType)
      .eq("city_slug", input.citySlug)
      .eq("audit_category_slug", input.categorySlug)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100),
    op.service
      .from("rule_source_category_links")
      .select(
        `
        source_id,
        rule_sources (
          id,
          title,
          parent_page_url,
          direct_file_url,
          knowledge_document_id,
          human_review_status,
          status,
          jurisdiction_id
        )
      `
      )
      .eq("audit_category_slug", input.categorySlug)
      .limit(200),
  ])

  if (candidatesRes.error) {
    return { ok: false, error: toUserErrorMessage(candidatesRes.error) }
  }
  if (linksRes.error) {
    return { ok: false, error: toUserErrorMessage(linksRes.error) }
  }

  const pending: CategoryPdfCandidateRow[] = (candidatesRes.data ?? []).map(
    (row) => ({
      id: row.id as string,
      title: String(row.title),
      parentPageUrl: (row.parent_page_url as string | null) ?? null,
      directFileUrl: (row.direct_file_url as string | null) ?? null,
      discoveryMethod: row.discovery_method as CategoryPdfCandidateRow["discoveryMethod"],
      existingSourceId: (row.existing_source_id as string | null) ?? null,
      jurisdictionId: (row.jurisdiction_id as string | null) ?? null,
      status: "pending",
    })
  )

  const adopted: CategoryPdfAdoptedRow[] = []
  for (const row of linksRes.data ?? []) {
    const raw = row as Record<string, unknown>
    const srcRaw = raw.rule_sources
    const src = (Array.isArray(srcRaw) ? srcRaw[0] : srcRaw) as {
      id: string
      title: string
      parent_page_url: string | null
      direct_file_url: string | null
      knowledge_document_id: string | null
      human_review_status: string
      status: string
      jurisdiction_id: string
    } | null
    if (!src || src.status !== "active") continue
    if (!juris.jurisdictionIds.includes(src.jurisdiction_id)) continue
    adopted.push({
      linkSourceId: src.id,
      title: src.title,
      parentPageUrl: src.parent_page_url,
      directFileUrl: src.direct_file_url,
      knowledgeDocumentId: src.knowledge_document_id,
      humanReviewStatus: src.human_review_status,
      layerLabel: juris.codeToLabel.get(src.jurisdiction_id) ?? "公開情報",
    })
  }

  return { ok: true, data: { pending, adopted } }
}

/**
 * 国・県・市の登録済み公開情報から、カテゴリに合いそうなPDF／URLを候補化する。
 */
export async function discoverCategoryPdfCandidatesAction(input: {
  serviceSlug: string
  citySlug: string
  categorySlug: string
}): Promise<ActionResult<{ added: number }>> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const serviceType = resolveServiceType(input.serviceSlug)
  const category = getAuditCategoryBySlug(input.categorySlug)
  if (!serviceType || !category) {
    return { ok: false, error: "サービスまたはカテゴリが見つかりません。" }
  }

  const juris = await loadJurisdictionIdsForCity(op.service, input.citySlug)
  if (!juris || juris.jurisdictionIds.length === 0) {
    return { ok: false, error: "自治体情報を取得できませんでした。" }
  }

  const { data: sources, error: sourcesError } = await op.service
    .from("rule_sources")
    .select(
      "id, title, parent_page_url, direct_file_url, memo, jurisdiction_id, status"
    )
    .in("jurisdiction_id", juris.jurisdictionIds)
    .eq("service_type", serviceType)
    .eq("status", "active")
    .limit(500)

  if (sourcesError) {
    return { ok: false, error: toUserErrorMessage(sourcesError) }
  }

  const { data: links } = await op.service
    .from("rule_source_category_links")
    .select("source_id")
    .eq("audit_category_slug", input.categorySlug)

  const { data: rejected } = await op.service
    .from("rule_category_pdf_candidates")
    .select("existing_source_id")
    .eq("service_type", serviceType)
    .eq("city_slug", input.citySlug)
    .eq("audit_category_slug", input.categorySlug)
    .eq("status", "rejected")
    .not("existing_source_id", "is", null)

  const alreadyLinked = new Set(
    (links ?? []).map((r) => r.source_id as string)
  )
  const rejectedIds = new Set(
    (rejected ?? [])
      .map((r) => r.existing_source_id as string | null)
      .filter(Boolean) as string[]
  )

  const { data: existingPending } = await op.service
    .from("rule_category_pdf_candidates")
    .select("existing_source_id")
    .eq("service_type", serviceType)
    .eq("city_slug", input.citySlug)
    .eq("audit_category_slug", input.categorySlug)
    .eq("status", "pending")
    .not("existing_source_id", "is", null)

  const pendingSourceIds = new Set(
    (existingPending ?? [])
      .map((r) => r.existing_source_id as string | null)
      .filter(Boolean) as string[]
  )

  const discoverable = pickDiscoverableSources({
    sources: (sources ?? []).map(
      (s): DiscoverableSource => ({
        id: s.id as string,
        title: String(s.title),
        parent_page_url: (s.parent_page_url as string | null) ?? null,
        direct_file_url: (s.direct_file_url as string | null) ?? null,
        memo: (s.memo as string | null) ?? null,
        jurisdiction_id: s.jurisdiction_id as string,
      })
    ),
    category,
    alreadyLinkedSourceIds: alreadyLinked,
    rejectedSourceIds: rejectedIds,
  }).filter((s) => !pendingSourceIds.has(s.id))

  let added = 0
  for (const src of discoverable) {
    const { error } = await op.service.from("rule_category_pdf_candidates").insert({
      service_type: serviceType,
      city_slug: input.citySlug,
      audit_category_slug: input.categorySlug,
      jurisdiction_id: src.jurisdiction_id,
      title: src.title,
      parent_page_url: src.parent_page_url,
      direct_file_url: src.direct_file_url,
      existing_source_id: src.id,
      discovery_method: "keyword_match",
      status: "pending",
    })
    if (!error) added += 1
  }

  revalidateCategoryPaths()
  return { ok: true, data: { added } }
}

/**
 * 候補を手動追加する（URLを人が貼る）。
 */
export async function addManualCategoryPdfCandidateAction(input: {
  serviceSlug: string
  citySlug: string
  categorySlug: string
  title: string
  parentPageUrl?: string
  directFileUrl?: string
}): Promise<ActionResult<{ id: string }>> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const serviceType = resolveServiceType(input.serviceSlug)
  if (!serviceType || !isAuditCategorySlug(input.categorySlug)) {
    return { ok: false, error: "サービスまたはカテゴリが見つかりません。" }
  }

  const title = input.title.trim()
  const parent = input.parentPageUrl?.trim() || null
  const direct = input.directFileUrl?.trim() || null
  if (!title) return { ok: false, error: "資料名を入力してください。" }
  if (!parent && !direct) {
    return { ok: false, error: "親ページURLまたはPDF直リンクを入力してください。" }
  }

  const juris = await loadJurisdictionIdsForCity(op.service, input.citySlug)
  if (!juris) return { ok: false, error: "自治体情報を取得できませんでした。" }

  const { data, error } = await op.service
    .from("rule_category_pdf_candidates")
    .insert({
      service_type: serviceType,
      city_slug: input.citySlug,
      audit_category_slug: input.categorySlug,
      jurisdiction_id: juris.cityJurisdictionId,
      title,
      parent_page_url: parent,
      direct_file_url: direct,
      discovery_method: "manual",
      status: "pending",
    })
    .select("id")
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: toUserErrorMessage(error) || "候補の追加に失敗しました。",
    }
  }

  revalidateCategoryPaths()
  return { ok: true, data: { id: data.id as string } }
}

/**
 * 候補を採用：カテゴリへ紐付け、PDFなら台帳監視を開始する。
 */
export async function adoptCategoryPdfCandidateAction(input: {
  candidateId: string
}): Promise<
  ActionResult<{
    sourceId: string
    monitoringReady: boolean
    message: string
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }
  if (!input.candidateId) {
    return { ok: false, error: "候補が指定されていません。" }
  }

  const { data: candidate, error: loadError } = await op.service
    .from("rule_category_pdf_candidates")
    .select("*")
    .eq("id", input.candidateId)
    .eq("status", "pending")
    .maybeSingle()

  if (loadError) return { ok: false, error: toUserErrorMessage(loadError) }
  if (!candidate) {
    return { ok: false, error: "了承待ちの候補が見つかりませんでした。" }
  }

  const categorySlug = candidate.audit_category_slug as string
  let sourceId = (candidate.existing_source_id as string | null) ?? null

  if (!sourceId) {
    const jurisdictionId =
      (candidate.jurisdiction_id as string | null) ?? null
    if (!jurisdictionId) {
      return {
        ok: false,
        error: "自治体が未設定のため採用できません。市の公開情報から登録してください。",
      }
    }
    const parent = (candidate.parent_page_url as string | null) ?? null
    const direct = (candidate.direct_file_url as string | null) ?? null
    const fileType =
      direct &&
      (direct.toLowerCase().includes(".pdf") ||
        direct.toLowerCase().includes("application/pdf"))
        ? "pdf"
        : null

    const { data: inserted, error: insertError } = await op.service
      .from("rule_sources")
      .insert({
        jurisdiction_id: jurisdictionId,
        title: String(candidate.title),
        service_type: candidate.service_type,
        material_category: "訪問介護",
        source_kind: "manual",
        parent_page_url: parent,
        direct_file_url: direct,
        official_url: direct || parent,
        file_type: fileType,
        status: "active",
        human_review_status: "verified",
        last_verified_at: new Date().toISOString(),
        memo: `監査カテゴリ「${categorySlug}」で採用`,
      })
      .select("id")
      .single()

    if (insertError || !inserted) {
      return {
        ok: false,
        error: toUserErrorMessage(insertError) || "公開情報の作成に失敗しました。",
      }
    }
    sourceId = inserted.id as string
  } else {
    await op.service
      .from("rule_sources")
      .update({
        human_review_status: "verified",
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", sourceId)
  }

  const { error: linkError } = await op.service
    .from("rule_source_category_links")
    .upsert(
      {
        source_id: sourceId,
        audit_category_slug: categorySlug,
        created_by: op.userId,
      },
      { onConflict: "source_id,audit_category_slug" }
    )

  if (linkError) {
    return { ok: false, error: toUserErrorMessage(linkError) }
  }

  const ensure = await ensureKnowledgeDocumentFromRuleSource(
    op.service,
    sourceId
  )

  await op.service
    .from("rule_category_pdf_candidates")
    .update({
      status: "adopted",
      adopted_source_id: sourceId,
      reviewed_at: new Date().toISOString(),
      reviewed_by: op.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.candidateId)

  revalidateCategoryPaths()
  return {
    ok: true,
    data: {
      sourceId,
      monitoringReady: ensure.monitoringReady,
      message: ensure.message,
    },
  }
}

/**
 * 候補を不採用：一覧から外す（削除扱い）。
 */
export async function rejectCategoryPdfCandidateAction(input: {
  candidateId: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }
  if (!input.candidateId) {
    return { ok: false, error: "候補が指定されていません。" }
  }

  const { data, error } = await op.service
    .from("rule_category_pdf_candidates")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: op.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.candidateId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  if (!data) {
    return { ok: false, error: "了承待ちの候補が見つかりませんでした。" }
  }

  revalidateCategoryPaths()
  return { ok: true }
}

/**
 * 採用済みリンクを外す（カテゴリから外す。公開情報本体は残す）。
 */
export async function unlinkCategoryPdfAction(input: {
  sourceId: string
  categorySlug: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }
  if (!input.sourceId || !isAuditCategorySlug(input.categorySlug)) {
    return { ok: false, error: "対象が不正です。" }
  }

  const { error } = await op.service
    .from("rule_source_category_links")
    .delete()
    .eq("source_id", input.sourceId)
    .eq("audit_category_slug", input.categorySlug)

  if (error) return { ok: false, error: toUserErrorMessage(error) }

  revalidateCategoryPaths()
  return { ok: true }
}
