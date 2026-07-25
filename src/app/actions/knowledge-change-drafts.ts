"use server"

import { revalidatePath } from "next/cache"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import type {
  KnowledgeDocument,
  KnowledgeDocumentChangeDraft,
  KnowledgeDocumentSnapshot,
} from "@/types/database"
import type { KnowledgeChangeItem } from "@/lib/knowledge/diff-draft"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  status?: number
  data?: T
}

export type PendingChangeDraftRow = KnowledgeDocumentChangeDraft & {
  knowledge_documents: Pick<
    KnowledgeDocument,
    "id" | "title" | "applicable_year" | "region_name" | "jurisdiction_level"
  > | null
  before_snapshot: Pick<
    KnowledgeDocumentSnapshot,
    "id" | "is_truncated" | "content_hash" | "captured_at"
  > | null
  after_snapshot: Pick<
    KnowledgeDocumentSnapshot,
    "id" | "is_truncated" | "content_hash" | "captured_at"
  > | null
}

function normalizeJoined<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function countPendingChangeDraftsAction(): Promise<
  ActionResult<{ count: number }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { count, error } = await op.service
    .from("knowledge_document_change_drafts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  return { ok: true, data: { count: count ?? 0 } }
}

export async function listPendingChangeDraftsAction(): Promise<
  ActionResult<{ drafts: PendingChangeDraftRow[] }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { data, error } = await op.service
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
      ),
      before_snapshot:knowledge_document_snapshots!before_snapshot_id (
        id,
        is_truncated,
        content_hash,
        captured_at
      ),
      after_snapshot:knowledge_document_snapshots!after_snapshot_id (
        id,
        is_truncated,
        content_hash,
        captured_at
      )
    `
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  const drafts = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      ...(row as KnowledgeDocumentChangeDraft),
      knowledge_documents: normalizeJoined(
        r.knowledge_documents as PendingChangeDraftRow["knowledge_documents"]
      ),
      before_snapshot: normalizeJoined(
        r.before_snapshot as PendingChangeDraftRow["before_snapshot"]
      ),
      after_snapshot: normalizeJoined(
        r.after_snapshot as PendingChangeDraftRow["after_snapshot"]
      ),
    } satisfies PendingChangeDraftRow
  })

  return { ok: true, data: { drafts } }
}

function needsStrictReason(draft: KnowledgeDocumentChangeDraft): boolean {
  if (!draft.ai_organized) return true
  if (draft.quote_verified_ratio == null) return true
  return Number(draft.quote_verified_ratio) < 1
}

export async function approveChangeDraftAction(input: {
  draftId: string
  reviewReason: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const reason = input.reviewReason.trim()
  if (!reason) {
    return {
      ok: false,
      status: 422,
      error: "承認理由を入力してください（原文確認の記録として残します）。",
    }
  }

  const { data: draft, error: fetchError } = await op.service
    .from("knowledge_document_change_drafts")
    .select("*")
    .eq("id", input.draftId)
    .eq("status", "pending")
    .maybeSingle()

  if (fetchError) {
    return { ok: false, error: toUserErrorMessage(fetchError) }
  }
  if (!draft) {
    return { ok: false, error: "対象の承認待ち案件が見つかりませんでした。" }
  }

  const typed = draft as KnowledgeDocumentChangeDraft
  if (needsStrictReason(typed) && reason.length < 10) {
    return {
      ok: false,
      status: 422,
      error:
        "引用未検証またはAI整理なしの案件です。原文確認の内容を10文字以上で記録してください。",
    }
  }

  const { data: doc, error: docError } = await op.service
    .from("knowledge_documents")
    .select("*")
    .eq("id", typed.knowledge_document_id)
    .maybeSingle()

  if (docError || !doc) {
    return {
      ok: false,
      error: "対象マニュアルの取得に失敗しました。",
    }
  }

  const document = doc as KnowledgeDocument
  const now = new Date().toISOString()
  const changes = (typed.changes ?? []) as KnowledgeChangeItem[]

  const { error: versionError } = await op.service
    .from("knowledge_document_versions")
    .insert({
      knowledge_document_id: document.id,
      draft_id: typed.id,
      snapshot_id: typed.after_snapshot_id,
      title: document.title,
      source_url: document.source_url ?? null,
      content_hash: document.content_hash ?? null,
      ai_summary: typed.ai_summary,
      changes,
      approved_by: op.userId,
      approved_at: now,
    })

  if (versionError) {
    return { ok: false, error: toUserErrorMessage(versionError) }
  }

  const { error: updateError } = await op.service
    .from("knowledge_document_change_drafts")
    .update({
      status: "approved",
      reviewer_user_id: op.userId,
      reviewed_at: now,
      review_reason: reason,
    })
    .eq("id", typed.id)
    .eq("status", "pending")

  if (updateError) {
    return { ok: false, error: toUserErrorMessage(updateError) }
  }

  // 台帳の updated_at を更新（content_hash は検知時に更新済み）
  await op.service
    .from("knowledge_documents")
    .update({ updated_at: now })
    .eq("id", document.id)

  const regionLabel = document.region_name
    ? `${document.region_name}の`
    : document.jurisdiction_level === "国"
      ? "国の"
      : ""
  await op.service.from("app_announcements").insert({
    title: `${regionLabel}行政マニュアルの更新を反映しました`,
    body: `「${document.title}」（${document.applicable_year}年度）の内容更新が運営確認のうえ台帳へ反映されました。チェック用のAI判定ルールへの自動反映はありません。必要に応じてルール改訂案を作成・承認してください。`,
    kind: "knowledge_update",
    knowledge_document_id: document.id,
  })

  revalidatePath("/admin/document-changes")
  revalidatePath("/admin/rules/documents")
  revalidatePath("/admin/documents")
  revalidatePath("/admin/rules/regulatory")
  revalidatePath("/")
  return { ok: true }
}

export async function rejectChangeDraftAction(input: {
  draftId: string
  reviewReason: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const reason = input.reviewReason.trim()
  if (!reason) {
    return {
      ok: false,
      status: 422,
      error: "差し戻し理由を入力してください。",
    }
  }

  const now = new Date().toISOString()
  const { data, error } = await op.service
    .from("knowledge_document_change_drafts")
    .update({
      status: "rejected",
      reviewer_user_id: op.userId,
      reviewed_at: now,
      review_reason: reason,
    })
    .eq("id", input.draftId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }
  if (!data) {
    return { ok: false, error: "対象の承認待ち案件が見つかりませんでした。" }
  }

  revalidatePath("/admin/document-changes")
  revalidatePath("/admin/rules/documents")
  revalidatePath("/admin/documents")
  revalidatePath("/admin/rules/regulatory")
  return { ok: true }
}
