"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { toUserErrorMessage } from "@/lib/auth-errors"
import {
  isFindingAddressed,
  sortFindings,
} from "@/lib/check/findings-sort"
import { pickCheckSetPrimaryId } from "@/lib/check/alignment-catalog"
import type {
  Document,
  Finding,
  FindingActionType,
  FindingStatus,
} from "@/types/database"

export type CheckSetMember = {
  id: string
  original_name: string
  status: string
  created_at: string
}

export type FindingView = Finding & {
  sourceFileName?: string | null
}

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

async function requireOrgContext() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error:
        "ログインの有効期限が切れた可能性があります。再度ログインしてください。",
    } as const
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return {
      error:
        "事業所情報を取得できませんでした。オンボーディングが完了しているかご確認ください。",
    } as const
  }

  return {
    supabase,
    user,
    organizationId: profile.organization_id as string,
    role: profile.role as string,
  } as const
}

export async function getDocumentWithFindingsAction(
  documentId: string
): Promise<
  ActionResult<{
    document: Document
    findings: FindingView[]
    pendingReviewCount: number
    allAddressed: boolean
    setupHint?: string
    setMembers: CheckSetMember[]
    primaryDocumentId: string
    isSetPrimary: boolean
  }>
> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { data: document, error: docError } = await ctx.supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle()

  if (docError || !document) {
    return {
      ok: false,
      error: "書類が見つかりません。一覧を更新してから再度お試しください。",
    }
  }

  const setId = (document.check_set_id as string | null | undefined)?.trim()
  let setMembers: CheckSetMember[] = [
    {
      id: document.id as string,
      original_name: document.original_name as string,
      status: document.status as string,
      created_at: document.created_at as string,
    },
  ]
  if (setId) {
    const { data: members } = await ctx.supabase
      .from("documents")
      .select("id, original_name, status, created_at")
      .eq("organization_id", ctx.organizationId)
      .eq("check_set_id", setId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
    if (members && members.length > 0) {
      setMembers = members as CheckSetMember[]
    }
  }

  const primaryDocumentId =
    pickCheckSetPrimaryId(setMembers) ?? (document.id as string)
  const isSetPrimary = document.id === primaryDocumentId
  const findingDocIds = isSetPrimary
    ? setMembers.map((m) => m.id)
    : [document.id as string]
  const nameById = new Map(setMembers.map((m) => [m.id, m.original_name]))

  // 承認済み findings（RLS）
  // マイグレーション未適用時はテーブル不在 → 空配列で続行（404にしない）
  const { data: findings, error: findError } = await ctx.supabase
    .from("findings")
    .select("*")
    .in("document_id", findingDocIds)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  let setupHint: string | undefined
  if (findError) {
    const msg = findError.message ?? ""
    const code = findError.code ?? ""
    const missingTable =
      code === "42P01" ||
      msg.includes("findings") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist")
    if (missingTable) {
      setupHint =
        "チェック結果テーブル（findings）がまだありません。Supabase SQL Editor で supabase/migrations/20260711020000_findings_check.sql を実行してください。"
    } else {
      return { ok: false, error: toUserErrorMessage(findError) }
    }
  }

  // pending 件数はサービスロールで確認（ユーザーには見えない）
  let pendingReviewCount = 0
  if (!setupHint) {
    try {
      const admin = createServiceClient()
      const { count } = await admin
        .from("findings")
        .select("id", { count: "exact", head: true })
        .in("document_id", findingDocIds)
        .eq("review_status", "pending")
        .is("deleted_at", null)
      pendingReviewCount = count ?? 0
    } catch {
      pendingReviewCount = 0
    }
  }

  const list = sortFindings((findings ?? []) as Finding[]).map((f) => ({
    ...f,
    sourceFileName:
      setMembers.length > 1 ? (nameById.get(f.document_id) ?? null) : null,
  }))
  const allAddressed =
    list.length > 0 &&
    list.every((f) => isFindingAddressed(f.status)) &&
    document.status !== "checking"

  return {
    ok: true,
    data: {
      document: document as Document,
      findings: list,
      pendingReviewCount,
      allAddressed,
      setupHint,
      setMembers,
      primaryDocumentId,
      isSetPrimary,
    },
  }
}

/**
 * 指摘へのアクション：対応した / あとで / 違うと思う
 */
export async function updateFindingAction(input: {
  findingId: string
  action: "fixed" | "later" | "dismissed"
  feedbackReason?: string
}): Promise<ActionResult<{ finding: Finding; allAddressed: boolean }>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { data: finding, error: findError } = await ctx.supabase
    .from("findings")
    .select("*")
    .eq("id", input.findingId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle()

  if (findError || !finding) {
    return {
      ok: false,
      error: "指摘が見つかりません。画面を更新してから再度お試しください。",
    }
  }

  const nextStatus: FindingStatus =
    input.action === "fixed"
      ? "fixed"
      : input.action === "dismissed"
        ? "dismissed"
        : "later"

  const logAction: FindingActionType =
    input.action === "fixed"
      ? "fixed"
      : input.action === "dismissed"
        ? "dismissed"
        : "later"

  const now = new Date().toISOString()

  const { error: updateError } = await ctx.supabase
    .from("findings")
    .update({ status: nextStatus, updated_at: now })
    .eq("id", input.findingId)
    .eq("organization_id", ctx.organizationId)

  if (updateError) {
    return { ok: false, error: toUserErrorMessage(updateError) }
  }

  // 操作ログ（月次レポート集計用）— 「あとで」も含めて残す
  const { error: logError } = await ctx.supabase
    .from("finding_action_logs")
    .insert({
      finding_id: input.findingId,
      document_id: finding.document_id,
      organization_id: ctx.organizationId,
      actor_id: ctx.user.id,
      action: logAction,
      note: input.feedbackReason?.slice(0, 500) ?? null,
    })

  if (logError) {
    return { ok: false, error: toUserErrorMessage(logError) }
  }

  if (input.action === "dismissed") {
    const { error: fbError } = await ctx.supabase
      .from("finding_feedback")
      .insert({
        finding_id: input.findingId,
        document_id: finding.document_id,
        organization_id: ctx.organizationId,
        actor_id: ctx.user.id,
        reason: input.feedbackReason?.slice(0, 1000) ?? "これは違うと思う",
      })
    if (fbError) {
      return { ok: false, error: toUserErrorMessage(fbError) }
    }
  }

  // 全件対応済み（open / later が無い）なら documents.status = done
  const { data: findingDoc } = await ctx.supabase
    .from("documents")
    .select("id, check_set_id")
    .eq("id", finding.document_id)
    .maybeSingle()
  const setId = (findingDoc?.check_set_id as string | null | undefined)?.trim()
  let addressedDocIds = [finding.document_id as string]
  if (setId) {
    const { data: members } = await ctx.supabase
      .from("documents")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("check_set_id", setId)
      .is("deleted_at", null)
    if (members && members.length > 0) {
      addressedDocIds = members.map((m) => m.id as string)
    }
  }

  const { data: siblings } = await ctx.supabase
    .from("findings")
    .select("id, status")
    .in("document_id", addressedDocIds)
    .is("deleted_at", null)

  const trulyAllAddressed =
    (siblings ?? []).length === 0 ||
    (siblings ?? []).every((s) => isFindingAddressed(s.status as FindingStatus))

  if (trulyAllAddressed) {
    await ctx.supabase
      .from("documents")
      .update({ status: "done" })
      .in("id", addressedDocIds)
      .eq("organization_id", ctx.organizationId)
  }

  const { data: updated } = await ctx.supabase
    .from("findings")
    .select("*")
    .eq("id", input.findingId)
    .maybeSingle()

  for (const id of addressedDocIds) {
    revalidatePath(`/check/${id}`)
  }
  revalidatePath("/documents")
  revalidatePath("/later")
  revalidatePath("/reports")
  revalidatePath("/", "layout")

  return {
    ok: true,
    data: {
      finding: (updated ?? { ...finding, status: nextStatus }) as Finding,
      allAddressed: trulyAllAddressed,
    },
  }
}

export type LaterFindingRow = Finding & {
  documents: {
    id: string
    original_name: string
    doc_type: string
  } | null
}

/**
 * あとで確認リスト（/later 画面用）
 */
export async function listLaterFindingsAction(): Promise<
  ActionResult<{ findings: LaterFindingRow[] }>
> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { data, error } = await ctx.supabase
    .from("findings")
    .select(
      `
      *,
      documents (
        id,
        original_name,
        doc_type
      )
    `
    )
    .eq("organization_id", ctx.organizationId)
    .eq("status", "later")
    .eq("review_status", "approved")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  return {
    ok: true,
    data: { findings: (data ?? []) as LaterFindingRow[] },
  }
}

/**
 * あとで確認の残件数（ナビバッジ用）
 */
export async function countLaterFindingsAction(): Promise<
  ActionResult<{ count: number }>
> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { count, error } = await ctx.supabase
    .from("findings")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .eq("status", "later")
    .eq("review_status", "approved")
    .is("deleted_at", null)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  return { ok: true, data: { count: count ?? 0 } }
}

/**
 * 事業所管理者：人間レビュー承認（skip_finding_review=false 時）
 */
export async function approveDocumentFindingsAction(
  documentId: string
): Promise<ActionResult> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  if (ctx.role !== "admin") {
    return {
      ok: false,
      error: "承認は事業所の管理者のみ行えます。",
    }
  }

  const admin = createServiceClient()
  const { error } = await admin
    .from("findings")
    .update({
      review_status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("document_id", documentId)
    .eq("organization_id", ctx.organizationId)
    .eq("review_status", "pending")
    .is("deleted_at", null)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidatePath(`/check/${documentId}`)
  return { ok: true }
}

/**
 * 人間レビューのスキップ設定
 */
export async function updateSkipFindingReviewAction(
  skip: boolean
): Promise<ActionResult> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  if (ctx.role !== "admin") {
    return { ok: false, error: "設定の変更は管理者のみ行えます。" }
  }

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ skip_finding_review: skip })
    .eq("id", ctx.organizationId)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidatePath("/settings")
  return { ok: true }
}
