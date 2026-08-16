import { createServiceClient } from "@/lib/supabase/server"
import {
  extractDocumentContent,
  shouldSkipDifyForExtract,
} from "@/lib/check/extract"
import { runDifyCheck } from "@/lib/dify/client"
import { decideMockMode } from "@/lib/dify/env"
import {
  normalizeSeverity,
  type DifyFindingItem,
  type MockScenario,
} from "@/lib/dify/types"
import { prefectureFromMunicipality } from "@/lib/municipalities"
import {
  isSimilarPlanDateFinding,
  PLAN_DATE_ALIGNMENT_CODE,
  withBuiltinPlanDateAlignmentRule,
} from "@/lib/check/plan-date-alignment"
import {
  mergeAiFindingsWithCatalog,
  pickCheckSetPrimaryId,
  runAlignmentCatalog,
} from "@/lib/check/alignment-catalog"
import {
  resolveApprovedRulesForCheck,
  serializeRegulatoryBasisForDify,
  serializeRulesForDify,
  toAppliedRulesSnapshot,
} from "@/lib/rule-engine/resolve-check-rules"
import {
  computePurgeAfter,
  type OriginalKeepDays,
} from "@/lib/documents/retention"
import { purgeDocumentOriginal } from "@/lib/documents/purge-originals"
import type { DocumentStatus } from "@/types/database"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type RunCheckOptions = {
  documentId: string
  organizationId: string
  mockScenario?: MockScenario
}

export type RunCheckResult = {
  ok: boolean
  error?: string
  findingCount?: number
  usedFallback?: boolean
  reviewStatus?: "pending" | "approved"
  /** live=本物の Dify / mock=ローカルモック / skipped_no_file|dify_error|unreadable=未呼び出し */
  mode?: "live" | "mock" | "skipped_no_file" | "dify_error" | "unreadable"
}

type AdminClient = ReturnType<typeof createServiceClient>

type SetDoc = {
  id: string
  organization_id: string
  doc_type: string
  file_path: string
  original_name: string
  mime_type: string | null
  status: string
  keep_original_days: number | null
  original_purged_at: string | null
  created_at: string
  check_set_id: string | null
}

type ExtractedDoc = {
  doc: SetDoc
  kind?: "text" | "image" | "empty"
  text?: string
  imageBase64?: string
  imageMimeType?: string
  downloadFailed: boolean
}

const SET_DOC_SELECT =
  "id, organization_id, doc_type, file_path, original_name, mime_type, status, deleted_at, keep_original_days, original_purged_at, created_at, check_set_id"
const SET_DOC_SELECT_LEGACY =
  "id, organization_id, doc_type, file_path, original_name, mime_type, status, deleted_at, keep_original_days, original_purged_at, created_at"

function isMissingCheckSetColumn(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes("check_set_id"))
}

/**
 * 書類チェック。同じ check_set_id の分は1回で本文を足し、書類同士＋ルールブックを見る。
 */
export async function runDocumentCheck(
  options: RunCheckOptions
): Promise<RunCheckResult> {
  const admin = createServiceClient()

  let seedQuery = await admin
    .from("documents")
    .select(SET_DOC_SELECT)
    .eq("id", options.documentId)
    .eq("organization_id", options.organizationId)
    .is("deleted_at", null)
    .maybeSingle()

  if (isMissingCheckSetColumn(seedQuery.error)) {
    seedQuery = await admin
      .from("documents")
      .select(SET_DOC_SELECT_LEGACY)
      .eq("id", options.documentId)
      .eq("organization_id", options.organizationId)
      .is("deleted_at", null)
      .maybeSingle()
  }

  const seedDoc = seedQuery.data
  const docError = seedQuery.error

  if (docError || !seedDoc) {
    return { ok: false, error: "書類が見つかりません。" }
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id, municipality, skip_finding_review")
    .eq("id", options.organizationId)
    .maybeSingle()

  if (orgError || !org) {
    return { ok: false, error: "事業所情報を取得できませんでした。" }
  }

  const setDocs = await loadCheckSetDocs(admin, seedDoc as SetDoc)
  const primaryId =
    pickCheckSetPrimaryId(setDocs) ?? (seedDoc.id as string)

  await admin
    .from("documents")
    .update({ status: "checking" satisfies DocumentStatus })
    .in(
      "id",
      setDocs.map((d) => d.id)
    )
    .eq("organization_id", options.organizationId)

  const extracted: ExtractedDoc[] = []
  for (const doc of setDocs) {
    extracted.push(await extractSetMember(admin, doc))
  }

  const texts = extracted.map((e) => e.text ?? "")
  const catalogFindings = runAlignmentCatalog(texts)
  console.error("[check] plan_date_alignment", {
    documentId: primaryId,
    setSize: setDocs.length,
    mismatched: catalogFindings.length > 0,
  })

  const municipality = org.municipality?.trim() || ""
  const skipReview = Boolean(org.skip_finding_review)
  let totalFindings = 0
  let usedFallback = false
  let skippedAll = true
  let anyDifyError = false
  let anyUnreadable = false
  let calledDify = false

  for (const item of extracted) {
    const isPrimary = item.doc.id === primaryId
    const catalog = isPrimary ? catalogFindings : []
    const one = await finishSetMember(admin, {
      item,
      organizationId: options.organizationId,
      municipality,
      skipReview,
      mockScenario: options.mockScenario,
      catalogFindings: catalog,
      deferReviewed: true,
    })
    if (!one.ok) {
      await admin
        .from("documents")
        .update({ status: "reviewed" satisfies DocumentStatus })
        .in(
          "id",
          setDocs.map((d) => d.id)
        )
        .eq("organization_id", options.organizationId)
      return { ok: false, error: one.error }
    }
    totalFindings += one.findingCount
    if (one.usedFallback) usedFallback = true
    if (!item.downloadFailed) skippedAll = false
    if (one.mode === "dify_error") anyDifyError = true
    if (one.mode === "unreadable") anyUnreadable = true
    if (one.mode === "live" || one.mode === "mock") calledDify = true
  }

  await admin
    .from("documents")
    .update({ status: "reviewed" satisfies DocumentStatus })
    .in(
      "id",
      setDocs.map((d) => d.id)
    )
    .eq("organization_id", options.organizationId)

  const mock = decideMockMode({ mockScenario: options.mockScenario }).mock
  const mode: RunCheckResult["mode"] = skippedAll
    ? "skipped_no_file"
    : anyUnreadable && !calledDify
      ? "unreadable"
      : anyDifyError && totalFindings === catalogFindings.length + setDocs.length
        ? "dify_error"
        : mock
          ? "mock"
          : "live"

  console.error("[check] finished", {
    documentId: primaryId,
    setSize: setDocs.length,
    findingCount: totalFindings,
    usedFallback,
    mode,
    catalogCount: catalogFindings.length,
  })

  return {
    ok: true,
    findingCount: totalFindings,
    usedFallback,
    reviewStatus: skipReview ? "approved" : "pending",
    mode,
  }
}

async function loadCheckSetDocs(
  admin: AdminClient,
  seed: SetDoc
): Promise<SetDoc[]> {
  const setId = seed.check_set_id?.trim()
  if (!setId) return [seed]

  const { data, error } = await admin
    .from("documents")
    .select(SET_DOC_SELECT)
    .eq("organization_id", seed.organization_id)
    .eq("check_set_id", setId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error || !data || data.length === 0) return [seed]
  return data as SetDoc[]
}

async function extractSetMember(
  admin: AdminClient,
  doc: SetDoc
): Promise<ExtractedDoc> {
  const { data: fileData, error: downloadError } = await admin.storage
    .from("documents")
    .download(doc.file_path)

  if (downloadError || !fileData) {
    console.error("[check] storage_download_failed", {
      documentId: doc.id,
      hasPath: Boolean(doc.file_path),
      pathDepth: doc.file_path?.split("/").length ?? 0,
      mimeType: doc.mime_type,
      errorMessage: downloadError?.message?.slice(0, 200) ?? "empty_body",
      errorName: downloadError?.name?.slice(0, 80),
    })
    return { doc, downloadFailed: true }
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const extracted = await extractDocumentContent(
    buffer,
    doc.mime_type,
    doc.original_name
  )
  console.error("[check] extracted", {
    documentId: doc.id,
    kind: extracted.kind,
    textLength: extracted.text?.length ?? 0,
    hasImage: Boolean(extracted.imageBase64),
    bufferBytes: buffer.length,
  })
  return {
    doc,
    kind: extracted.kind,
    text: extracted.text,
    imageBase64: extracted.imageBase64,
    imageMimeType: extracted.imageMimeType,
    downloadFailed: false,
  }
}

async function finishSetMember(
  admin: AdminClient,
  opts: {
    item: ExtractedDoc
    organizationId: string
    municipality: string
    skipReview: boolean
    mockScenario?: MockScenario
    catalogFindings: DifyFindingItem[]
    deferReviewed?: boolean
  }
): Promise<{
  ok: boolean
  error?: string
  findingCount: number
  usedFallback: boolean
  mode?: RunCheckResult["mode"]
}> {
  const { item, catalogFindings } = opts
  const doc = item.doc

  if (item.downloadFailed) {
    await saveFallbackAndFinish(admin, {
      documentId: doc.id,
      organizationId: opts.organizationId,
      skipReview: opts.skipReview,
      reason: "file_download_failed",
      extraFindings: catalogFindings,
      deferReviewed: opts.deferReviewed,
    })
    return {
      ok: true,
      findingCount: 1 + catalogFindings.length,
      usedFallback: true,
      mode: "skipped_no_file",
    }
  }

  const useNational = !opts.municipality
  const rulesResolution = await resolveApprovedRulesForCheck(admin, {
    municipality: opts.municipality,
    docType: doc.doc_type,
  })
  const rulesForCheck = withBuiltinPlanDateAlignmentRule(rulesResolution.rules)
  const rulesSnapshot = toAppliedRulesSnapshot({
    ...rulesResolution,
    rules: rulesForCheck,
    truncated:
      rulesResolution.truncated ||
      rulesResolution.rules.filter((r) => r.code !== PLAN_DATE_ALIGNMENT_CODE)
        .length >= 40,
  })

  console.error("[check] applied_rules", {
    documentId: doc.id,
    asOf: rulesResolution.asOf,
    ruleCount: rulesForCheck.length,
    basisCount: rulesResolution.regulatoryBasis.length,
    truncated: rulesSnapshot.truncated,
  })

  if (shouldSkipDifyForExtract(item)) {
    console.error("[check] skip_dify_unreadable", {
      documentId: doc.id,
      kind: item.kind ?? "text",
      textLength: item.text?.length ?? 0,
    })
    await saveFallbackAndFinish(admin, {
      documentId: doc.id,
      organizationId: opts.organizationId,
      skipReview: opts.skipReview,
      reason: "extract_unreadable",
      rulesSnapshot,
      extraFindings: catalogFindings,
      deferReviewed: opts.deferReviewed,
      unreadable: true,
    })
    return {
      ok: true,
      findingCount: 1 + catalogFindings.length,
      usedFallback: true,
      mode: "unreadable",
    }
  }

  let difyResult
  try {
    difyResult = await runDifyCheck({
      municipality: opts.municipality,
      prefecture: prefectureFromMunicipality(opts.municipality),
      national: useNational ? "1" : "0",
      docType: doc.doc_type,
      documentText: item.text,
      imageBase64: item.imageBase64,
      imageMimeType: item.imageMimeType,
      approvedRulesJson: serializeRulesForDify(rulesForCheck),
      regulatoryBasisJson: serializeRegulatoryBasisForDify(
        rulesResolution.regulatoryBasis
      ),
      checkAsOf: rulesResolution.asOf,
      mockScenario: opts.mockScenario,
    })
  } catch (err) {
    console.error("[check] dify_invoke_failed", {
      documentId: doc.id,
      errorKind: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    })
    await saveFallbackAndFinish(admin, {
      documentId: doc.id,
      organizationId: opts.organizationId,
      skipReview: opts.skipReview,
      reason: "dify_invoke_failed",
      rulesSnapshot,
      extraFindings: catalogFindings,
      deferReviewed: opts.deferReviewed,
    })
    return {
      ok: true,
      findingCount: 1 + catalogFindings.length,
      usedFallback: true,
      mode: "dify_error",
    }
  }

  const reviewStatus = opts.skipReview ? "approved" : "pending"
  await admin
    .from("findings")
    .update({ deleted_at: new Date().toISOString() })
    .eq("document_id", doc.id)
    .is("deleted_at", null)

  const severityOrder = { high: 0, mid: 1, low: 2 } as const
  const { anonymizeFindingFields } = await import("@/lib/privacy/anonymize")
  const mergedFindings = mergeAiFindingsWithCatalog(
    difyResult.findings,
    catalogFindings
  )
  const rows = mergedFindings
    .map((f, index) => {
      const anon = anonymizeFindingFields({
        title: (f.title ?? "ご確認ください").slice(0, 200),
        description: (f.description ?? "内容をご確認ください。").slice(0, 4000),
        basis: f.basis?.slice(0, 1000) ?? null,
        suggestion: f.suggestion?.slice(0, 4000) ?? null,
      })
      const isAlignment =
        catalogFindings.length > 0 && isSimilarPlanDateFinding(f)
      return {
        document_id: doc.id,
        organization_id: opts.organizationId,
        severity: normalizeSeverity(f.severity),
        title: anon.title,
        description: anon.description,
        basis: anon.basis,
        suggestion: anon.suggestion,
        status: "open" as const,
        review_status: reviewStatus,
        is_fallback:
          Boolean(difyResult.usedFallback) && !isAlignment,
        source_kind: isAlignment ? ("alignment" as const) : ("ai" as const),
        sort_order: isAlignment
          ? index
          : 100 + severityOrder[normalizeSeverity(f.severity)] * 100 + index,
      }
    })
    .sort((a, b) => a.sort_order - b.sort_order)

  if (rows.length > 0) {
    type InsertedFinding = {
      id: string
      title: string
      description: string
      suggestion: string | null
    }
    let inserted: InsertedFinding[] | null = null
    const first = await admin
      .from("findings")
      .insert(rows)
      .select("id, title, description, suggestion")
    if (
      first.error &&
      String(first.error.message ?? "").includes("source_kind")
    ) {
      const fallbackRows = rows.map((row) => {
        const { source_kind: _sourceKind, ...rest } = row
        void _sourceKind
        return rest
      })
      const retry = await admin
        .from("findings")
        .insert(fallbackRows)
        .select("id, title, description, suggestion")
      if (retry.error) {
        return {
          ok: false,
          error: "チェック結果の保存に失敗しました。",
          findingCount: 0,
          usedFallback: false,
        }
      }
      inserted = (retry.data ?? []) as InsertedFinding[]
    } else if (first.error) {
      return {
        ok: false,
        error: "チェック結果の保存に失敗しました。",
        findingCount: 0,
        usedFallback: false,
      }
    } else {
      inserted = (first.data ?? []) as InsertedFinding[]
    }

    try {
      const { generateDeadlinesFromFindings } = await import(
        "@/lib/check/generate-deadlines"
      )
      await generateDeadlinesFromFindings(admin, {
        organizationId: opts.organizationId,
        documentId: doc.id,
        docType: doc.doc_type,
        findings: (inserted ?? []).map((f) => ({
          id: f.id as string,
          title: f.title as string,
          description: f.description as string,
          suggestion: f.suggestion as string | null,
        })),
      })
    } catch {
      // 期限テーブル未作成時などはチェック本体を止めない
    }
  }

  const docPatch: Record<string, unknown> = {}
  if (!opts.deferReviewed) {
    docPatch.status = "reviewed" satisfies DocumentStatus
  }
  docPatch.check_as_of = rulesSnapshot.asOf
  docPatch.applied_rule_version_ids = rulesForCheck
    .map((r) => r.versionId)
    .filter((id) => UUID_RE.test(id))
  docPatch.applied_rules_snapshot = rulesSnapshot

  await admin.from("documents").update(docPatch).eq("id", doc.id)

  await applyOriginalRetentionAfterCheck(admin, {
    documentId: doc.id,
    organizationId: opts.organizationId,
    filePath: doc.file_path,
    keepOriginalDays: (Number(doc.keep_original_days) === 7
      ? 7
      : 0) as OriginalKeepDays,
    alreadyPurged: Boolean(doc.original_purged_at),
  })

  const mode: RunCheckResult["mode"] = decideMockMode({
    mockScenario: opts.mockScenario,
  }).mock
    ? "mock"
    : "live"

  return {
    ok: true,
    findingCount: rows.length,
    usedFallback: Boolean(difyResult.usedFallback),
    mode,
  }
}

async function saveFallbackAndFinish(
  admin: AdminClient,
  opts: {
    documentId: string
    organizationId: string
    skipReview: boolean
    reason: string
    rulesSnapshot?: ReturnType<typeof toAppliedRulesSnapshot>
    extraFindings?: DifyFindingItem[]
    deferReviewed?: boolean
    unreadable?: boolean
  }
) {
  void opts.reason
  const reviewStatus = opts.skipReview ? "approved" : "pending"
  const { buildFallbackFinding, buildUnreadableFinding } = await import(
    "@/lib/dify/parse"
  )
  const { anonymizeFindingFields } = await import("@/lib/privacy/anonymize")
  const extra = opts.extraFindings ?? []

  await admin
    .from("findings")
    .update({ deleted_at: new Date().toISOString() })
    .eq("document_id", opts.documentId)
    .is("deleted_at", null)

  const extraRows = extra.map((f, index) => {
    const anon = anonymizeFindingFields({
      title: (f.title ?? "ご確認ください").slice(0, 200),
      description: (f.description ?? "内容をご確認ください。").slice(0, 4000),
      basis: f.basis?.slice(0, 1000) ?? null,
      suggestion: f.suggestion?.slice(0, 4000) ?? null,
    })
    return {
      document_id: opts.documentId,
      organization_id: opts.organizationId,
      severity: normalizeSeverity(f.severity),
      title: anon.title,
      description: anon.description,
      basis: anon.basis,
      suggestion: anon.suggestion,
      status: "open" as const,
      review_status: reviewStatus,
      is_fallback: false,
      source_kind: "alignment" as const,
      sort_order: index,
    }
  })

  const fb = opts.unreadable
    ? buildUnreadableFinding()
    : buildFallbackFinding()
  const anon = anonymizeFindingFields({
    title: fb.title ?? "ご確認ください",
    description: fb.description ?? "内容をご確認ください。",
    basis: fb.basis ?? null,
    suggestion: fb.suggestion ?? null,
  })

  await admin.from("findings").insert([
    ...extraRows,
    {
      document_id: opts.documentId,
      organization_id: opts.organizationId,
      severity: "mid",
      title: anon.title,
      description: anon.description,
      basis: anon.basis,
      suggestion: anon.suggestion,
      status: "open",
      review_status: reviewStatus,
      is_fallback: true,
      source_kind: "ai",
      sort_order: extraRows.length + 100,
    },
  ])

  const docPatch: Record<string, unknown> = {}
  if (!opts.deferReviewed) {
    docPatch.status = "reviewed" satisfies DocumentStatus
  }
  if (opts.rulesSnapshot) {
    docPatch.check_as_of = opts.rulesSnapshot.asOf
    docPatch.applied_rule_version_ids = opts.rulesSnapshot.rules
      .map((r) => r.versionId)
      .filter((id) => UUID_RE.test(id))
    docPatch.applied_rules_snapshot = opts.rulesSnapshot
  }

  if (Object.keys(docPatch).length > 0) {
    await admin.from("documents").update(docPatch).eq("id", opts.documentId)
  }

  const { data: docMeta } = await admin
    .from("documents")
    .select("file_path, keep_original_days, original_purged_at")
    .eq("id", opts.documentId)
    .maybeSingle()

  if (docMeta) {
    await applyOriginalRetentionAfterCheck(admin, {
      documentId: opts.documentId,
      organizationId: opts.organizationId,
      filePath: (docMeta.file_path as string) ?? "",
      keepOriginalDays: (Number(docMeta.keep_original_days) === 7
        ? 7
        : 0) as OriginalKeepDays,
      alreadyPurged: Boolean(docMeta.original_purged_at),
    })
  }
}

async function applyOriginalRetentionAfterCheck(
  admin: AdminClient,
  opts: {
    documentId: string
    organizationId: string
    filePath: string
    keepOriginalDays: OriginalKeepDays
    alreadyPurged: boolean
  }
): Promise<void> {
  if (opts.alreadyPurged) return

  const purgeAfter = computePurgeAfter(opts.keepOriginalDays)
  await admin
    .from("documents")
    .update({ original_purge_after: purgeAfter })
    .eq("id", opts.documentId)
    .eq("organization_id", opts.organizationId)

  if (opts.keepOriginalDays <= 0) {
    await purgeDocumentOriginal(
      opts.documentId,
      opts.filePath,
      opts.organizationId,
      admin
    )
  }
}
