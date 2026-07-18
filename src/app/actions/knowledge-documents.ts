"use server"

import { revalidatePath } from "next/cache"
import { createHash } from "crypto"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import {
  syncAllKnowledgeDocuments,
  syncKnowledgeDocument,
} from "@/lib/knowledge/sync"
import { trySaveKnowledgePdfSnapshot } from "@/lib/knowledge/snapshots"
import type {
  AppAnnouncement,
  JurisdictionLevel,
  KnowledgeDocument,
  KnowledgeSyncAlert,
  KnowledgeWatchKind,
} from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

export async function listKnowledgeDocumentsAction(): Promise<
  ActionResult<{ documents: KnowledgeDocument[] }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { data, error } = await op.service
    .from("knowledge_documents")
    .select("*")
    .order("updated_at", { ascending: false })

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  return {
    ok: true,
    data: { documents: (data ?? []) as KnowledgeDocument[] },
  }
}

export async function listOpenKnowledgeSyncAlertsAction(): Promise<
  ActionResult<{ alerts: KnowledgeSyncAlert[] }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { data, error } = await op.service
    .from("knowledge_sync_alerts")
    .select(
      `
      *,
      knowledge_documents (
        id,
        title,
        region_name,
        jurisdiction_level
      )
    `
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  return {
    ok: true,
    data: { alerts: (data ?? []) as KnowledgeSyncAlert[] },
  }
}

export async function resolveKnowledgeSyncAlertAction(
  alertId: string
): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { error } = await op.service
    .from("knowledge_sync_alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: op.userId,
    })
    .eq("id", alertId)
    .eq("status", "open")

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidatePath("/admin/documents")
  return { ok: true }
}

export async function archiveKnowledgeDocumentAction(
  documentId: string
): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { error } = await op.service
    .from("knowledge_documents")
    .update({ status: "archived" })
    .eq("id", documentId)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidatePath("/admin/documents")
  return { ok: true }
}

export async function registerKnowledgeDocumentAction(input: {
  title: string
  jurisdictionLevel: JurisdictionLevel
  regionName: string
  applicableYear: number
  sourceUrl?: string
  watchKind?: KnowledgeWatchKind
  cssSelector?: string
  /** PDFをアップロードした場合のバイナリ（任意） */
  fileBase64?: string
  fileName?: string
}): Promise<ActionResult<{ document: KnowledgeDocument }>> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const title = input.title.trim()
  if (!title) {
    return { ok: false, error: "マニュアル名を入力してください。" }
  }

  const needsRegion = input.jurisdictionLevel !== "国"
  const regionName = needsRegion ? input.regionName.trim() : null
  if (needsRegion && !regionName) {
    return {
      ok: false,
      error:
        "都道府県・市区町村を選んだときは、地域名を入力してください（例：神奈川県）。",
    }
  }

  if (
    !Number.isInteger(input.applicableYear) ||
    input.applicableYear < 2000 ||
    input.applicableYear > 2100
  ) {
    return {
      ok: false,
      error: "適用年度は2000〜2100の整数で入力してください。",
    }
  }

  const watchKind: KnowledgeWatchKind =
    input.watchKind === "index" ? "index" : "file"
  const cssSelector = input.cssSelector?.trim() || null

  if (watchKind === "index" && !cssSelector) {
    return {
      ok: false,
      error:
        "一覧監視（index）では、記事1件を指すCSSセレクタを入力してください。",
    }
  }

  const sourceUrl = input.sourceUrl?.trim() || null
  if (watchKind === "index" && !sourceUrl) {
    return {
      ok: false,
      error: "一覧監視では監視用のページURL（source_url）が必須です。",
    }
  }

  if (sourceUrl) {
    try {
      const u = new URL(sourceUrl)
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return { ok: false, error: "source_url は http(s) のURLにしてください。" }
      }
    } catch {
      return {
        ok: false,
        error:
          watchKind === "index"
            ? "監視用ページURLの形式をご確認ください。"
            : "監視用PDFのURL形式をご確認ください。",
      }
    }
  }

  let contentHash: string | null = null
  let contentBytes: number | null = null
  if (input.fileBase64) {
    if (watchKind === "index") {
      return {
        ok: false,
        error:
          "一覧監視（index）ではPDFアップロードは使わず、ページURLとセレクタを登録してください。",
      }
    }
    const buf = Buffer.from(input.fileBase64, "base64")
    contentBytes = buf.byteLength
    contentHash = createHash("sha256").update(buf).digest("hex")
  }

  const { data, error } = await op.service
    .from("knowledge_documents")
    .insert({
      title,
      jurisdiction_level: input.jurisdictionLevel,
      region_name: regionName,
      applicable_year: input.applicableYear,
      source_url: sourceUrl,
      watch_kind: watchKind,
      css_selector: watchKind === "index" ? cssSelector : null,
      content_hash: contentHash,
      content_bytes: contentBytes,
      dify_document_id: contentHash
        ? `dify-upload-${contentHash.slice(0, 12)}`
        : sourceUrl
          ? null
          : `dify-manual-${Date.now()}`,
      status: "active",
      last_sync_status: contentHash ? "ok" : null,
    })
    .select("*")
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: error
        ? toUserErrorMessage(error)
        : "登録に失敗しました。マイグレーション適用をご確認ください。",
    }
  }

  const document = data as KnowledgeDocument

  // PDFアップロード時は初回スナップショット（変更前ベースライン）を保存
  if (input.fileBase64 && contentHash) {
    await trySaveKnowledgePdfSnapshot({
      service: op.service,
      knowledgeDocumentId: document.id,
      contentHash,
      pdfBuffer: Buffer.from(input.fileBase64, "base64"),
      sourceUrlAtCapture: sourceUrl,
    })
  }

  // source_url があれば直後に1回同期を試す
  if (sourceUrl) {
    await syncKnowledgeDocument(document, op.service)
    const { data: refreshed } = await op.service
      .from("knowledge_documents")
      .select("*")
      .eq("id", document.id)
      .single()
    if (refreshed) {
      revalidatePath("/admin/documents")
      revalidatePath("/")
      return {
        ok: true,
        data: { document: refreshed as KnowledgeDocument },
      }
    }
  }

  revalidatePath("/admin/documents")
  return { ok: true, data: { document } }
}

export async function runKnowledgeSyncNowAction(
  documentId?: string
): Promise<
  ActionResult<{
    results: Array<{ documentId: string; status: string; message?: string }>
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  try {
    if (documentId) {
      const { data, error } = await op.service
        .from("knowledge_documents")
        .select("*")
        .eq("id", documentId)
        .single()
      if (error || !data) {
        return {
          ok: false,
          error: "対象のマニュアルが見つかりませんでした。",
        }
      }
      const result = await syncKnowledgeDocument(
        data as KnowledgeDocument,
        op.service
      )
      revalidatePath("/admin/documents")
      revalidatePath("/")
      return { ok: true, data: { results: [result] } }
    }

    const { results } = await syncAllKnowledgeDocuments()
    revalidatePath("/admin/documents")
    revalidatePath("/")
    return { ok: true, data: { results } }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "同期に失敗しました。通信状況をご確認ください。",
    }
  }
}

export async function listAppAnnouncementsAction(
  limit = 3
): Promise<ActionResult<{ announcements: AppAnnouncement[] }>> {
  const { createClient } = await import("@/lib/supabase/server")
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "ログインが必要です。" }
  }

  const { data, error } = await supabase
    .from("app_announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 10))

  if (error) {
    // テーブル未作成時は空で返す（ダッシュボードを壊さない）
    return { ok: true, data: { announcements: [] } }
  }

  return {
    ok: true,
    data: { announcements: (data ?? []) as AppAnnouncement[] },
  }
}
