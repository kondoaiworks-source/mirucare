import { createServiceClient } from "@/lib/supabase/server"
import { extractDocumentContent } from "@/lib/check/extract"
import { runDifyCheck } from "@/lib/dify/client"
import { normalizeSeverity, type MockScenario } from "@/lib/dify/types"
import { prefectureFromMunicipality } from "@/lib/municipalities"
import type { DocumentStatus } from "@/types/database"

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
}

/**
 * 書類1件の AI チェックを実行し findings を保存する。
 * Service Role で Storage / findings INSERT を行う。
 */
export async function runDocumentCheck(
  options: RunCheckOptions
): Promise<RunCheckResult> {
  const admin = createServiceClient()

  const { data: doc, error: docError } = await admin
    .from("documents")
    .select(
      "id, organization_id, doc_type, file_path, original_name, mime_type, status, deleted_at"
    )
    .eq("id", options.documentId)
    .eq("organization_id", options.organizationId)
    .is("deleted_at", null)
    .maybeSingle()

  if (docError || !doc) {
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

  // ステータスを checking に（冪等）
  await admin
    .from("documents")
    .update({ status: "checking" satisfies DocumentStatus })
    .eq("id", doc.id)

  const { data: fileData, error: downloadError } = await admin.storage
    .from("documents")
    .download(doc.file_path)

  if (downloadError || !fileData) {
    await saveFallbackAndFinish(admin, {
      documentId: doc.id,
      organizationId: options.organizationId,
      skipReview: Boolean(org.skip_finding_review),
      reason: "file_download_failed",
    })
    return {
      ok: true,
      findingCount: 1,
      usedFallback: true,
      reviewStatus: org.skip_finding_review ? "approved" : "pending",
    }
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const extracted = await extractDocumentContent(
    buffer,
    doc.mime_type,
    doc.original_name
  )

  const municipality = org.municipality?.trim() || ""
  const useNational = !municipality
  const difyResult = await runDifyCheck({
    municipality,
    prefecture: prefectureFromMunicipality(municipality),
    national: useNational ? "1" : "0",
    docType: doc.doc_type,
    documentText: extracted.text,
    imageBase64: extracted.imageBase64,
    imageMimeType: extracted.imageMimeType,
    mockScenario: options.mockScenario,
  })

  const reviewStatus = org.skip_finding_review ? "approved" : "pending"

  // 既存 findings を論理削除して差し替え（再実行対応）
  await admin
    .from("findings")
    .update({ deleted_at: new Date().toISOString() })
    .eq("document_id", doc.id)
    .is("deleted_at", null)

  const severityOrder = { high: 0, mid: 1, low: 2 } as const
  const rows = difyResult.findings
    .map((f, index) => ({
      document_id: doc.id,
      organization_id: options.organizationId,
      severity: normalizeSeverity(f.severity),
      title: (f.title ?? "ご確認ください").slice(0, 200),
      description: (f.description ?? "内容をご確認ください。").slice(0, 4000),
      basis: f.basis?.slice(0, 1000) ?? null,
      suggestion: f.suggestion?.slice(0, 4000) ?? null,
      status: "open" as const,
      review_status: reviewStatus,
      is_fallback: difyResult.usedFallback,
      sort_order: severityOrder[normalizeSeverity(f.severity)] * 100 + index,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)

  if (rows.length > 0) {
    const { data: inserted, error: insertError } = await admin
      .from("findings")
      .insert(rows)
      .select("id, title, description, suggestion")

    if (insertError) {
      return {
        ok: false,
        error: "チェック結果の保存に失敗しました。",
      }
    }

    try {
      const { generateDeadlinesFromFindings } = await import(
        "@/lib/check/generate-deadlines"
      )
      await generateDeadlinesFromFindings(admin, {
        organizationId: options.organizationId,
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

  await admin
    .from("documents")
    .update({ status: "reviewed" satisfies DocumentStatus })
    .eq("id", doc.id)

  return {
    ok: true,
    findingCount: rows.length,
    usedFallback: difyResult.usedFallback,
    reviewStatus,
  }
}

async function saveFallbackAndFinish(
  admin: ReturnType<typeof createServiceClient>,
  opts: {
    documentId: string
    organizationId: string
    skipReview: boolean
    reason: string
  }
) {
  void opts.reason
  const reviewStatus = opts.skipReview ? "approved" : "pending"
  const { buildFallbackFinding } = await import("@/lib/dify/parse")
  const fb = buildFallbackFinding()

  await admin
    .from("findings")
    .update({ deleted_at: new Date().toISOString() })
    .eq("document_id", opts.documentId)
    .is("deleted_at", null)

  await admin.from("findings").insert({
    document_id: opts.documentId,
    organization_id: opts.organizationId,
    severity: "mid",
    title: fb.title,
    description: fb.description,
    basis: fb.basis,
    suggestion: fb.suggestion,
    status: "open",
    review_status: reviewStatus,
    is_fallback: true,
    sort_order: 0,
  })

  await admin
    .from("documents")
    .update({ status: "reviewed" satisfies DocumentStatus })
    .eq("id", opts.documentId)
}
