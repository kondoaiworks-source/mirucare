"use server"

import { revalidatePath } from "next/cache"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import { readSnapshotText, getLatestSnapshot } from "@/lib/knowledge/snapshots"
import { syncKnowledgeDocument } from "@/lib/knowledge/sync"
import type { KnowledgeChangeItem } from "@/lib/knowledge/diff-draft"
import {
  defaultEffectiveFrom,
  formatProposalChangeSummary,
  proposeRulesFromChangeDraft,
  proposeRulesFromSourceText,
  type AuditItemOption,
  type ProposedCheckRule,
} from "@/lib/knowledge/propose-rules"
import type { AiCheckRule } from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

function revalidateProposalPaths() {
  revalidatePath("/admin/rules")
  revalidatePath("/admin/rules/pending")
  revalidatePath("/admin/rules/ai-rules")
  revalidatePath("/admin/rules/history")
  revalidatePath("/admin/rules/regulatory", "layout")
  revalidatePath("/admin/rules/services", "layout")
  revalidatePath("/admin/document-changes")
}

async function loadAuditItemOptions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any
): Promise<ActionResult<AuditItemOption[]>> {
  const { data, error } = await service
    .from("audit_items")
    .select("id, code, title")
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .limit(80)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  const items = (data ?? []).map(
    (row: { id: string; code: string; title: string }) => ({
      id: row.id,
      code: row.code,
      title: row.title,
    })
  )

  if (items.length === 0) {
    return {
      ok: false,
      error:
        "カテゴリがありません。利用設定の「カテゴリ」で標準カテゴリセットを登録してからお試しください。",
    }
  }

  return { ok: true, data: items }
}

async function insertPendingProposals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  opts: {
    proposals: ProposedCheckRule[]
    sourceTitle: string
    knowledgeChangeDraftId?: string | null
    regionName?: string | null
    jurisdictionLevel?: string | null
  }
): Promise<ActionResult<{ createdCount: number; codes: string[] }>> {
  const createdCodes: string[] = []
  const effectiveFrom = defaultEffectiveFrom()

  for (const proposal of opts.proposals) {
    let code = proposal.code
    const { data: existing } = await service
      .from("ai_check_rules")
      .select("id")
      .eq("code", code)
      .maybeSingle()

    if (existing) {
      code = `${code}_${Date.now().toString(36).toUpperCase().slice(-4)}`
    }

    const { data: rule, error: ruleError } = await service
      .from("ai_check_rules")
      .insert({
        audit_item_id: proposal.auditItemId,
        code,
        title: proposal.title,
        target_doc_types: proposal.targetDocTypes,
        status: "active",
      })
      .select("*")
      .single()

    if (ruleError || !rule) {
      return { ok: false, error: toUserErrorMessage(ruleError) }
    }

    const changeSummary = formatProposalChangeSummary(
      proposal,
      opts.sourceTitle
    )

    const { error: verError } = await service
      .from("ai_check_rule_versions")
      .insert({
        rule_id: (rule as AiCheckRule).id,
        version_no: 1,
        check_logic: {
          type: "heuristic",
          notes: proposal.guidanceText,
          evidence: {
            sourceTitle: opts.sourceTitle,
            evidenceSummary: proposal.evidenceSummary,
            evidenceQuotes: proposal.evidenceQuotes,
            proposedBy: "gemini",
            regionName: opts.regionName ?? null,
            jurisdictionLevel: opts.jurisdictionLevel ?? null,
          },
        },
        guidance_text: proposal.guidanceText,
        severity: proposal.severity,
        effective_from: effectiveFrom,
        review_status: "pending_review",
        change_summary: changeSummary,
        knowledge_change_draft_id:
          opts.knowledgeChangeDraftId?.trim() || null,
      })

    if (verError) {
      return { ok: false, error: toUserErrorMessage(verError) }
    }

    createdCodes.push(code)
  }

  return {
    ok: true,
    data: { createdCount: createdCodes.length, codes: createdCodes },
  }
}

/**
 * マニュアル差分ドラフトから判定ルール案を生成し、承認待ちへ載せる。
 * 人が了承するまでチェック本番には使われない。
 */
export async function proposeAiCheckRulesFromDraftAction(input: {
  draftId: string
}): Promise<
  ActionResult<{ createdCount: number; codes: string[]; empty: boolean }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const draftId = input.draftId?.trim()
  if (!draftId) return { ok: false, error: "対象の差分が指定されていません。" }

  const { data: draft, error: draftError } = await op.service
    .from("knowledge_document_change_drafts")
    .select(
      `
      id,
      status,
      ai_summary,
      changes,
      knowledge_documents (
        id,
        title,
        region_name,
        jurisdiction_level
      )
    `
    )
    .eq("id", draftId)
    .maybeSingle()

  if (draftError) {
    return { ok: false, error: toUserErrorMessage(draftError) }
  }
  if (!draft) {
    return { ok: false, error: "差分ドラフトが見つかりません。" }
  }

  const { count: existingCount } = await op.service
    .from("ai_check_rule_versions")
    .select("id", { count: "exact", head: true })
    .eq("knowledge_change_draft_id", draftId)
    .eq("review_status", "pending_review")

  if ((existingCount ?? 0) > 0) {
    return {
      ok: false,
      error:
        "この差分からは、すでに承認待ちの判定ルール案があります。承認待ち画面でご確認ください。",
    }
  }

  const auditRes = await loadAuditItemOptions(op.service)
  if (!auditRes.ok || !auditRes.data) {
    return { ok: false, error: auditRes.error }
  }

  const docRaw = (draft as Record<string, unknown>).knowledge_documents
  const doc = (
    Array.isArray(docRaw) ? docRaw[0] : docRaw
  ) as {
    id: string
    title: string
    region_name: string | null
    jurisdiction_level: string | null
  } | null

  const sourceTitle = doc?.title ?? "マニュアル"
  const changes = (Array.isArray(draft.changes)
    ? draft.changes
    : []) as KnowledgeChangeItem[]

  const proposed = await proposeRulesFromChangeDraft({
    documentTitle: sourceTitle,
    regionName: doc?.region_name ?? null,
    jurisdictionLevel: doc?.jurisdiction_level ?? null,
    aiSummary: draft.ai_summary,
    changes,
    auditItems: auditRes.data,
  })

  if (!proposed.ok) {
    return { ok: false, error: proposed.error }
  }

  if (proposed.proposals.length === 0) {
    return {
      ok: true,
      data: { createdCount: 0, codes: [], empty: true },
    }
  }

  const inserted = await insertPendingProposals(op.service, {
    proposals: proposed.proposals,
    sourceTitle,
    knowledgeChangeDraftId: draftId,
    regionName: doc?.region_name ?? null,
    jurisdictionLevel: doc?.jurisdiction_level ?? null,
  })

  if (!inserted.ok || !inserted.data) {
    return { ok: false, error: inserted.error }
  }

  revalidateProposalPaths()
  return {
    ok: true,
    data: {
      createdCount: inserted.data.createdCount,
      codes: inserted.data.codes,
      empty: false,
    },
  }
}

/**
 * 公開情報監視の最新スナップショット本文から判定ルール案を生成し、承認待ちへ載せる。
 * 初回登録後（差分がなくても）ルールブックの中身を提案する用途。
 * スナップショット欠落時は最新スナップショットへフォールバックし、無ければ再同期を試みる。
 */
export async function proposeAiCheckRulesFromDocumentAction(input: {
  knowledgeDocumentId: string
}): Promise<
  ActionResult<{ createdCount: number; codes: string[]; empty: boolean }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }
  const service = op.service

  const documentId = input.knowledgeDocumentId?.trim()
  if (!documentId) {
    return { ok: false, error: "対象の資料が指定されていません。" }
  }

  const { data: docRow, error: docError } = await service
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle()

  if (docError) {
    return { ok: false, error: toUserErrorMessage(docError) }
  }
  if (!docRow) {
    return { ok: false, error: "資料が見つかりません。" }
  }

  type DocRow = {
    id: string
    title: string
    region_name: string | null
    jurisdiction_level: string | null
    content_hash: string | null
    status: string
    source_url: string | null
  }

  let doc = docRow as DocRow

  async function resolveSnapshot() {
    const hash = doc.content_hash?.trim() || null
    if (hash) {
      const { data, error } = await service
        .from("knowledge_document_snapshots")
        .select("*")
        .eq("knowledge_document_id", documentId)
        .eq("content_hash", hash)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(toUserErrorMessage(error))
      if (data) return data
    }
    return getLatestSnapshot(service, documentId)
  }

  let snapshot: Awaited<ReturnType<typeof resolveSnapshot>> = null
  try {
    snapshot = await resolveSnapshot()
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "スナップショットの確認に失敗しました。",
    }
  }

  // ハッシュはあるがスナップショット欠落 → 再同期して補完を試す
  if (!snapshot && doc.source_url?.trim()) {
    const syncResult = await syncKnowledgeDocument(
      docRow as Parameters<typeof syncKnowledgeDocument>[0],
      service
    )
    if (
      syncResult.status === "failed" ||
      syncResult.status === "suspicious" ||
      syncResult.status === "selector_broken"
    ) {
      return {
        ok: false,
        error:
          syncResult.message ??
          "本文の再同期に失敗しました。公開情報監視で同期結果をご確認ください。",
      }
    }

    const { data: refreshed } = await service
      .from("knowledge_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle()
    if (refreshed) {
      doc = refreshed as DocRow
    }

    try {
      snapshot = await resolveSnapshot()
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "再同期後のスナップショット確認に失敗しました。",
      }
    }

    if (!snapshot) {
      return {
        ok: false,
        error:
          syncResult.message?.trim()
            ? `${syncResult.message} 本文スナップショットを確認できませんでした。公開情報監視で「今すぐ同期」を実行し、Storage（knowledge-snapshots）をご確認ください。`
            : "再同期後も本文スナップショットがありません。公開情報監視で「今すぐ同期」を実行し、Storage（knowledge-snapshots）とPDF直リンクをご確認ください。",
      }
    }
  }

  if (!snapshot) {
    return {
      ok: false,
      error: doc.source_url?.trim()
        ? "本文スナップショットがありません。PDF直リンクで公開情報を登録し、公開情報監視で同期が成功しているかご確認ください。"
        : "本文スナップショットがありません。監視用のPDF直リンク（source_url）を登録してから、公開情報監視で同期してください。",
    }
  }

  let sourceText = ""
  try {
    sourceText = await readSnapshotText(service, snapshot)
  } catch {
    return {
      ok: false,
      error:
        "本文の読み取りに失敗しました。Storage（knowledge-snapshots）の設定をご確認ください。",
    }
  }

  if (!sourceText.trim()) {
    return {
      ok: false,
      error:
        "本文が空です。PDFから文字を抽出できていない可能性があります。別のPDF直リンクをご確認ください。",
    }
  }

  const auditRes = await loadAuditItemOptions(service)
  if (!auditRes.ok || !auditRes.data) {
    return { ok: false, error: auditRes.error }
  }

  const sourceTitle = String(doc.title)
  const proposed = await proposeRulesFromSourceText({
    documentTitle: sourceTitle,
    regionName: doc.region_name ?? null,
    jurisdictionLevel: doc.jurisdiction_level ?? null,
    sourceText,
    auditItems: auditRes.data,
  })

  if (!proposed.ok) {
    return { ok: false, error: proposed.error }
  }

  if (proposed.proposals.length === 0) {
    return {
      ok: true,
      data: { createdCount: 0, codes: [], empty: true },
    }
  }

  const inserted = await insertPendingProposals(service, {
    proposals: proposed.proposals,
    sourceTitle,
    knowledgeChangeDraftId: null,
    regionName: doc.region_name ?? null,
    jurisdictionLevel: doc.jurisdiction_level ?? null,
  })

  if (!inserted.ok || !inserted.data) {
    return { ok: false, error: inserted.error }
  }

  revalidateProposalPaths()
  return {
    ok: true,
    data: {
      createdCount: inserted.data.createdCount,
      codes: inserted.data.codes,
      empty: false,
    },
  }
}
