/**
 * 行政マニュアル PDF テキストのスナップショット保存
 * - 本文: Storage private バケット knowledge-snapshots
 * - メタ: knowledge_document_snapshots
 * - ソフト上限 2MB（超過時は切り詰め + is_truncated）
 */

import { extractPdfPlainText } from "@/lib/check/extract"
import { createServiceClient } from "@/lib/supabase/server"
import type { KnowledgeDocumentSnapshot } from "@/types/database"

export const KNOWLEDGE_SNAPSHOTS_BUCKET = "knowledge-snapshots"
/** 抽出テキストのソフト上限（UTF-8 バイト） */
export const SNAPSHOT_TEXT_SOFT_LIMIT_BYTES = 2 * 1024 * 1024

type ServiceClient = ReturnType<typeof createServiceClient>

export type PreparedSnapshotText = {
  text: string
  textBytes: number
  isTruncated: boolean
}

/**
 * UTF-8 バイトでソフト上限に切り詰める（マルチバイト途中切断を吸収）
 */
export function prepareSnapshotText(raw: string): PreparedSnapshotText {
  const buf = Buffer.from(raw, "utf8")
  if (buf.byteLength <= SNAPSHOT_TEXT_SOFT_LIMIT_BYTES) {
    return {
      text: raw,
      textBytes: buf.byteLength,
      isTruncated: false,
    }
  }

  let end = SNAPSHOT_TEXT_SOFT_LIMIT_BYTES
  let sliced = buf.subarray(0, end).toString("utf8")
  // 不完全シーケンス→置換文字でバイトが増える場合に備え、上限内まで削る
  while (
    end > 0 &&
    Buffer.byteLength(sliced, "utf8") > SNAPSHOT_TEXT_SOFT_LIMIT_BYTES
  ) {
    end -= 1
    sliced = buf.subarray(0, end).toString("utf8")
  }
  if (sliced.endsWith("\uFFFD")) {
    sliced = sliced.slice(0, -1)
  }

  return {
    text: sliced,
    textBytes: Buffer.byteLength(sliced, "utf8"),
    isTruncated: true,
  }
}

export function snapshotStoragePath(
  knowledgeDocumentId: string,
  contentHash: string
): string {
  return `${knowledgeDocumentId}/${contentHash}.txt`
}

export async function getSnapshotByHash(
  service: ServiceClient,
  knowledgeDocumentId: string,
  contentHash: string
): Promise<KnowledgeDocumentSnapshot | null> {
  const { data, error } = await service
    .from("knowledge_document_snapshots")
    .select("*")
    .eq("knowledge_document_id", knowledgeDocumentId)
    .eq("content_hash", contentHash)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return (data as KnowledgeDocumentSnapshot | null) ?? null
}

export async function getLatestSnapshot(
  service: ServiceClient,
  knowledgeDocumentId: string
): Promise<KnowledgeDocumentSnapshot | null> {
  const { data, error } = await service
    .from("knowledge_document_snapshots")
    .select("*")
    .eq("knowledge_document_id", knowledgeDocumentId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return (data as KnowledgeDocumentSnapshot | null) ?? null
}

export async function readSnapshotText(
  service: ServiceClient,
  snapshot: Pick<KnowledgeDocumentSnapshot, "storage_path">
): Promise<string> {
  const { data, error } = await service.storage
    .from(KNOWLEDGE_SNAPSHOTS_BUCKET)
    .download(snapshot.storage_path)

  if (error || !data) {
    throw new Error(
      error?.message ?? "スナップショット本文の取得に失敗しました。"
    )
  }
  return await data.text()
}

/**
 * PDFバッファからテキスト抽出し、Storage + DB に保存。
 * 同一 (doc_id, content_hash) が既にあれば作成せず返す。
 */
export async function saveKnowledgePdfSnapshot(opts: {
  service: ServiceClient
  knowledgeDocumentId: string
  contentHash: string
  pdfBuffer: Buffer
  sourceUrlAtCapture?: string | null
}): Promise<{
  snapshot: KnowledgeDocumentSnapshot
  created: boolean
  isTruncated: boolean
}> {
  const existing = await getSnapshotByHash(
    opts.service,
    opts.knowledgeDocumentId,
    opts.contentHash
  )
  if (existing) {
    return {
      snapshot: existing,
      created: false,
      isTruncated: existing.is_truncated,
    }
  }

  let rawText: string
  try {
    rawText = await extractPdfPlainText(opts.pdfBuffer)
  } catch (err) {
    console.error("[knowledge-snapshot] pdf_extract_failed", {
      documentId: opts.knowledgeDocumentId,
      error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    })
    rawText = ""
  }

  const prepared = prepareSnapshotText(rawText)
  const storagePath = snapshotStoragePath(
    opts.knowledgeDocumentId,
    opts.contentHash
  )

  const { error: uploadError } = await opts.service.storage
    .from(KNOWLEDGE_SNAPSHOTS_BUCKET)
    .upload(storagePath, prepared.text, {
      contentType: "text/plain; charset=utf-8",
      upsert: true,
    })

  if (uploadError) {
    throw new Error(
      `スナップショットの保存に失敗しました: ${uploadError.message}`
    )
  }

  const { data, error } = await opts.service
    .from("knowledge_document_snapshots")
    .insert({
      knowledge_document_id: opts.knowledgeDocumentId,
      content_hash: opts.contentHash,
      storage_path: storagePath,
      text_bytes: prepared.textBytes,
      is_truncated: prepared.isTruncated,
      source_url_at_capture: opts.sourceUrlAtCapture?.trim() || null,
    })
    .select("*")
    .single()

  if (error || !data) {
    // 並行実行で UNIQUE 衝突した場合は既存を返す
    if (error?.code === "23505") {
      const raced = await getSnapshotByHash(
        opts.service,
        opts.knowledgeDocumentId,
        opts.contentHash
      )
      if (raced) {
        return {
          snapshot: raced,
          created: false,
          isTruncated: raced.is_truncated,
        }
      }
    }
    throw new Error(
      error?.message ?? "スナップショットメタの保存に失敗しました。"
    )
  }

  if (prepared.isTruncated) {
    console.error("[knowledge-snapshot] truncated", {
      documentId: opts.knowledgeDocumentId,
      textBytes: prepared.textBytes,
      limit: SNAPSHOT_TEXT_SOFT_LIMIT_BYTES,
    })
  }

  return {
    snapshot: data as KnowledgeDocumentSnapshot,
    created: true,
    isTruncated: prepared.isTruncated,
  }
}

/**
 * 同期フロー用: 失敗しても同期本体を止めないラッパー
 */
export async function trySaveKnowledgePdfSnapshot(
  opts: Parameters<typeof saveKnowledgePdfSnapshot>[0]
): Promise<{
  snapshot: KnowledgeDocumentSnapshot
  created: boolean
  isTruncated: boolean
} | null> {
  try {
    return await saveKnowledgePdfSnapshot(opts)
  } catch (err) {
    console.error("[knowledge-snapshot] save_failed", {
      documentId: opts.knowledgeDocumentId,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    })
    return null
  }
}
