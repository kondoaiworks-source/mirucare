"use server"

import { createClient } from "@/lib/supabase/server"
import { toUserErrorMessage } from "@/lib/auth-errors"
import {
  SIGNED_URL_EXPIRES_IN,
  guessDocType,
  MAX_FILE_SIZE_BYTES,
  buildStoragePath,
} from "@/lib/documents"
import { assertCanStartChecks } from "@/app/actions/billing"
import type { DocType, Document, DocumentStatus } from "@/types/database"

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
  } as const
}

/**
 * アップロード準備：書類IDと保存パスを発行
 * （実ファイル送信はブラウザの認証済みクライアントで行う）
 */
export async function prepareDocumentUploadAction(input: {
  fileName: string
  mimeType: string
  fileSize: number
}): Promise<
  ActionResult<{
    documentId: string
    filePath: string
    suggestedDocType: DocType
  }>
> {
  if (input.fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error:
        "ファイルが大きすぎます。20MB以下のファイルをご用意ください。",
    }
  }

  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const documentId = crypto.randomUUID()
  const filePath = buildStoragePath(
    ctx.organizationId,
    documentId,
    input.fileName
  )

  return {
    ok: true,
    data: {
      documentId,
      filePath,
      suggestedDocType: guessDocType(input.fileName),
    },
  }
}

/**
 * @deprecated prepareDocumentUploadAction を使用
 * 互換のため残置：署名付きURL発行
 */
export async function createUploadUrlAction(input: {
  fileName: string
  mimeType: string
  fileSize: number
}): Promise<
  ActionResult<{
    documentId: string
    filePath: string
    uploadUrl: string
    token: string
    suggestedDocType: DocType
  }>
> {
  const prepared = await prepareDocumentUploadAction(input)
  if (!prepared.ok || !prepared.data) {
    return { ok: false, error: prepared.error }
  }

  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { data, error } = await ctx.supabase.storage
    .from("documents")
    .createSignedUploadUrl(prepared.data.filePath)

  if (error || !data) {
    return {
      ok: false,
      error: toUserErrorMessage(
        error,
        `アップロード用のURLを発行できませんでした。（${error?.message ?? "unknown"}）Storage に documents バケットがあるかご確認ください。`
      ),
    }
  }

  return {
    ok: true,
    data: {
      documentId: prepared.data.documentId,
      filePath: data.path || prepared.data.filePath,
      uploadUrl: data.signedUrl,
      token: data.token,
      suggestedDocType: prepared.data.suggestedDocType,
    },
  }
}

/**
 * Storage へのアップロード完了後に documents 行を作成
 */
export async function registerDocumentAction(input: {
  documentId: string
  filePath: string
  originalName: string
  mimeType: string
  fileSize: number
  docType: DocType
}): Promise<ActionResult<{ document: Document }>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { data, error } = await ctx.supabase
    .from("documents")
    .insert({
      id: input.documentId,
      organization_id: ctx.organizationId,
      uploaded_by: ctx.user.id,
      doc_type: input.docType,
      file_path: input.filePath,
      original_name: input.originalName,
      mime_type: input.mimeType,
      file_size: input.fileSize,
      status: "uploaded" satisfies DocumentStatus,
    })
    .select("*")
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: toUserErrorMessage(
        error,
        "書類情報の登録に失敗しました。再試行してください。"
      ),
    }
  }

  return { ok: true, data: { document: data as Document } }
}

export async function updateDocumentTypeAction(input: {
  documentId: string
  docType: DocType
}): Promise<ActionResult> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { error } = await ctx.supabase
    .from("documents")
    .update({ doc_type: input.docType })
    .eq("id", input.documentId)
    .eq("organization_id", ctx.organizationId)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }
  return { ok: true }
}

/**
 * チェック開始 → status=checking
 * 実際の AI 実行はクライアントから /api/check を呼ぶ（Cookie 付き）。
 */
export async function startDocumentCheckAction(
  documentIds: string[]
): Promise<ActionResult<{ documentIds: string[] }>> {
  if (documentIds.length === 0) {
    return {
      ok: false,
      error: "チェックする書類がありません。ファイルをアップロードしてください。",
    }
  }

  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const quota = await assertCanStartChecks(ctx.organizationId)
  if (!quota.allowed) {
    return {
      ok: false,
      error: quota.message ?? "現在のプランではチェックを開始できません。",
    }
  }

  const { error } = await ctx.supabase
    .from("documents")
    .update({ status: "checking" satisfies DocumentStatus })
    .in("id", documentIds)
    .eq("organization_id", ctx.organizationId)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  return { ok: true, data: { documentIds } }
}

export async function listDocumentsAction(): Promise<
  ActionResult<{ documents: Document[] }>
> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { data, error } = await ctx.supabase
    .from("documents")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  return { ok: true, data: { documents: (data ?? []) as Document[] } }
}

/**
 * 止まっている status=checking を findings の状態に合わせて解消する。
 * - 指摘なし / すべて fixed・dismissed → done
 * - open / later あり → reviewed
 */
export async function healStuckCheckingDocumentsAction(): Promise<
  ActionResult<{ healed: number }>
> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { data: stuck, error: stuckError } = await ctx.supabase
    .from("documents")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("status", "checking")
    .is("deleted_at", null)

  if (stuckError) {
    return { ok: false, error: toUserErrorMessage(stuckError) }
  }

  if (!stuck || stuck.length === 0) {
    return { ok: true, data: { healed: 0 } }
  }

  let healed = 0

  for (const doc of stuck) {
    const { data: findings, error: findError } = await ctx.supabase
      .from("findings")
      .select("status")
      .eq("document_id", doc.id)
      .is("deleted_at", null)

    // findings テーブル未作成時などはスキップ
    if (findError) continue

    const list = findings ?? []
    const hasPending = list.some(
      (f) => f.status === "open" || f.status === "later"
    )
    const nextStatus: DocumentStatus =
      list.length === 0 || !hasPending ? "done" : "reviewed"

    const { error: updateError } = await ctx.supabase
      .from("documents")
      .update({ status: nextStatus })
      .eq("id", doc.id)
      .eq("organization_id", ctx.organizationId)
      .eq("status", "checking")

    if (!updateError) healed += 1
  }

  return { ok: true, data: { healed } }
}

/**
 * 閲覧用の署名付きURL（有効期限10分）。直接公開URLは発行しない。
 */
export async function createSignedDownloadUrlAction(
  documentId: string
): Promise<ActionResult<{ url: string; expiresIn: number }>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { data: doc, error: docError } = await ctx.supabase
    .from("documents")
    .select("file_path")
    .eq("id", documentId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle()

  if (docError || !doc) {
    return {
      ok: false,
      error: "書類が見つかりません。一覧を更新してから再度お試しください。",
    }
  }

  const { data, error } = await ctx.supabase.storage
    .from("documents")
    .createSignedUrl(doc.file_path, SIGNED_URL_EXPIRES_IN)

  if (error || !data?.signedUrl) {
    return {
      ok: false,
      error: toUserErrorMessage(
        error,
        "ファイルの閲覧URLを発行できませんでした。再度お試しください。"
      ),
    }
  }

  return {
    ok: true,
    data: { url: data.signedUrl, expiresIn: SIGNED_URL_EXPIRES_IN },
  }
}

export async function softDeleteDocumentAction(
  documentId: string
): Promise<ActionResult> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { error } = await ctx.supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("organization_id", ctx.organizationId)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }
  return { ok: true }
}
