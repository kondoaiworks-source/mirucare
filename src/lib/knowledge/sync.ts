import { createHash } from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { sendResendEmail } from "@/lib/email/deadline-reminder"
import { buildKnowledgeSyncAlertEmail } from "@/lib/email/knowledge-sync-alert"
import type {
  KnowledgeDocument,
  KnowledgeSyncStatus,
} from "@/types/database"

export type SyncOneResult = {
  documentId: string
  title: string
  status: KnowledgeSyncStatus
  message?: string
  changed?: boolean
}

const FETCH_TIMEOUT_MS = 45_000
/** 前回比でサイズがこの倍率を超えたら疑い */
const SIZE_RATIO_SUSPICIOUS = 3
/** 絶対バイト数がこの値未満なら異常の可能性 */
const MIN_PDF_BYTES = 500

function sha256(buf: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(buf)).digest("hex")
}

function looksLikePdf(bytes: Uint8Array, contentType: string | null): boolean {
  if (bytes.length >= 4) {
    const header = `${String.fromCharCode(bytes[0]!)}${String.fromCharCode(bytes[1]!)}${String.fromCharCode(bytes[2]!)}${String.fromCharCode(bytes[3]!)}`
    if (header === "%PDF") return true
  }
  if (contentType?.toLowerCase().includes("pdf")) return true
  return false
}

function operatorEmails(): string[] {
  return (process.env.OPERATOR_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

async function notifyOperators(opts: {
  title: string
  kind: "failed" | "suspicious"
  message: string
  documentId: string
}) {
  const appUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "")
  const mail = buildKnowledgeSyncAlertEmail({
    documentTitle: opts.title,
    kind: opts.kind,
    message: opts.message,
    appUrl,
  })
  for (const to of operatorEmails()) {
    await sendResendEmail({
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
  }
}

/**
 * 1件の knowledge_documents を source_url から同期する（service role）。
 * Dify 実APIはモック更新（dify_document_id を刷新）まで。
 */
export async function syncKnowledgeDocument(
  doc: KnowledgeDocument,
  service: ReturnType<typeof createServiceClient> = createServiceClient()
): Promise<SyncOneResult> {
  const sourceUrl = doc.source_url?.trim()
  if (!sourceUrl) {
    return {
      documentId: doc.id,
      title: doc.title,
      status: "failed",
      message: "監視用のPDF直リンク（source_url）が未設定です。",
    }
  }

  const now = new Date().toISOString()
  let response: Response
  try {
    response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "application/pdf,*/*",
        "User-Agent": "MiruCare-KnowledgeSync/1.0",
      },
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? `取得に失敗しました（${error.name}）。通信状況またはURLをご確認ください。`
        : "取得に失敗しました。URLをご確認ください。"
    await markFailed(service, doc, now, message)
    return {
      documentId: doc.id,
      title: doc.title,
      status: "failed",
      message,
    }
  }

  if (!response.ok) {
    const message = `取得に失敗した可能性があります（HTTP ${response.status}）。URLをご確認ください。`
    await markFailed(service, doc, now, message)
    return {
      documentId: doc.id,
      title: doc.title,
      status: "failed",
      message,
    }
  }

  const buf = await response.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const contentType = response.headers.get("content-type")
  const byteLength = bytes.byteLength

  if (byteLength < MIN_PDF_BYTES || !looksLikePdf(bytes, contentType)) {
    const message =
      "取得結果がPDFではない可能性があります。内容タイプやURLをご確認ください。"
    await markSuspicious(service, doc, now, message)
    return {
      documentId: doc.id,
      title: doc.title,
      status: "suspicious",
      message,
    }
  }

  const hash = sha256(buf)
  const prevBytes = doc.content_bytes

  if (
    prevBytes != null &&
    prevBytes > 0 &&
    (byteLength > prevBytes * SIZE_RATIO_SUSPICIOUS ||
      prevBytes > byteLength * SIZE_RATIO_SUSPICIOUS)
  ) {
    const message = `ファイルサイズの変化が大きいため、自動更新を保留しました（前回 ${prevBytes} バイト → 今回 ${byteLength} バイト）。内容をご確認ください。`
    await markSuspicious(service, doc, now, message)
    return {
      documentId: doc.id,
      title: doc.title,
      status: "suspicious",
      message,
    }
  }

  if (doc.content_hash && doc.content_hash === hash) {
    await service
      .from("knowledge_documents")
      .update({
        last_checked_at: now,
        last_sync_status: "unchanged",
        last_error: null,
        content_bytes: byteLength,
      })
      .eq("id", doc.id)

    return {
      documentId: doc.id,
      title: doc.title,
      status: "unchanged",
      changed: false,
    }
  }

  // 変更あり：台帳更新＋お知らせ（Dify はモックID刷新）
  const difyId = `dify-sync-${hash.slice(0, 12)}`
  await service
    .from("knowledge_documents")
    .update({
      content_hash: hash,
      content_bytes: byteLength,
      last_checked_at: now,
      last_sync_status: "ok",
      last_error: null,
      dify_document_id: difyId,
      updated_at: now,
    })
    .eq("id", doc.id)

  const regionLabel = doc.region_name ? `${doc.region_name}の` : ""
  const annTitle = `${regionLabel || (doc.jurisdiction_level === "国" ? "国の" : "")}行政マニュアルを更新しました`
  const annBody = `「${doc.title}」（${doc.applicable_year}年度）の内容に更新があった可能性があります。チェック時の参照基準が変わっている場合がありますので、ご確認ください。`

  await service.from("app_announcements").insert({
    title: annTitle,
    body: annBody,
    kind: "knowledge_update",
    knowledge_document_id: doc.id,
  })

  return {
    documentId: doc.id,
    title: doc.title,
    status: "ok",
    changed: true,
    message: "内容の更新を反映し、お知らせを作成しました。",
  }
}

async function markFailed(
  service: ReturnType<typeof createServiceClient>,
  doc: KnowledgeDocument,
  now: string,
  message: string
) {
  await service
    .from("knowledge_documents")
    .update({
      last_checked_at: now,
      last_sync_status: "failed",
      last_error: message,
    })
    .eq("id", doc.id)

  await service.from("knowledge_sync_alerts").insert({
    knowledge_document_id: doc.id,
    kind: "failed",
    message,
    status: "open",
  })

  await notifyOperators({
    title: doc.title,
    kind: "failed",
    message,
    documentId: doc.id,
  })
}

async function markSuspicious(
  service: ReturnType<typeof createServiceClient>,
  doc: KnowledgeDocument,
  now: string,
  message: string
) {
  await service
    .from("knowledge_documents")
    .update({
      last_checked_at: now,
      last_sync_status: "suspicious",
      last_error: message,
    })
    .eq("id", doc.id)

  await service.from("knowledge_sync_alerts").insert({
    knowledge_document_id: doc.id,
    kind: "suspicious",
    message,
    status: "open",
  })

  await notifyOperators({
    title: doc.title,
    kind: "suspicious",
    message,
    documentId: doc.id,
  })
}

/** active かつ source_url がある全件を同期 */
export async function syncAllKnowledgeDocuments(): Promise<{
  results: SyncOneResult[]
  checked: number
}> {
  const service = createServiceClient()
  const { data, error } = await service
    .from("knowledge_documents")
    .select("*")
    .eq("status", "active")
    .not("source_url", "is", null)

  if (error) {
    throw new Error(error.message)
  }

  const docs = (data ?? []) as KnowledgeDocument[]
  const withUrl = docs.filter((d) => d.source_url?.trim())
  const results: SyncOneResult[] = []
  for (const doc of withUrl) {
    results.push(await syncKnowledgeDocument(doc, service))
  }
  return { results, checked: withUrl.length }
}
