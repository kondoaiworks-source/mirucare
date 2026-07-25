"use server"

import { revalidatePath } from "next/cache"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import { readSnapshotText } from "@/lib/knowledge/snapshots"
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
        "監査項目がありません。詳細設定で訪問介護テンプレート等を登録してからお試しください。",
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

  const sourceTitle = doc?.title ?? "行政資料"
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
 * 行政資料の最新スナップショット本文から判定ルール案を生成し、承認待ちへ載せる。
 * 初回登録後（差分がなくても）ルールブックの中身を提案する用途。
 */
export async function proposeAiCheckRulesFromDocumentAction(input: {
  knowledgeDocumentId: string
}): Promise<
  ActionResult<{ createdCount: number; codes: string[]; empty: boolean }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const documentId = input.knowledgeDocumentId?.trim()
  if (!documentId) {
    return { ok: false, error: "対象の行政資料が指定されていません。" }
  }

  const { data: doc, error: docError } = await op.service
    .from("knowledge_documents")
    .select(
      "id, title, region_name, jurisdiction_level, content_hash, status"
    )
    .eq("id", documentId)
    .maybeSingle()

  if (docError) {
    return { ok: false, error: toUserErrorMessage(docError) }
  }
  if (!doc) {
    return { ok: false, error: "行政資料が見つかりません。" }
  }

  const hash = (doc.content_hash as string | null)?.trim()
  if (!hash) {
    return {
      ok: false,
      error:
        "本文スナップショットがありません。先に監視同期またはPDF登録を行ってください。",
    }
  }

  const { data: snapshot, error: snapError } = await op.service
    .from("knowledge_document_snapshots")
    .select("*")
    .eq("knowledge_document_id", documentId)
    .eq("content_hash", hash)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (snapError) {
    return { ok: false, error: toUserErrorMessage(snapError) }
  }
  if (!snapshot) {
    return {
      ok: false,
      error: "本文スナップショットを取得できませんでした。",
    }
  }

  let sourceText = ""
  try {
    sourceText = await readSnapshotText(op.service, snapshot)
  } catch {
    return { ok: false, error: "本文の読み取りに失敗しました。" }
  }

  const auditRes = await loadAuditItemOptions(op.service)
  if (!auditRes.ok || !auditRes.data) {
    return { ok: false, error: auditRes.error }
  }

  const sourceTitle = String(doc.title)
  const proposed = await proposeRulesFromSourceText({
    documentTitle: sourceTitle,
    regionName: (doc.region_name as string | null) ?? null,
    jurisdictionLevel: (doc.jurisdiction_level as string | null) ?? null,
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

  const inserted = await insertPendingProposals(op.service, {
    proposals: proposed.proposals,
    sourceTitle,
    knowledgeChangeDraftId: null,
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
