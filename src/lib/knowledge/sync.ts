import { createHash } from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { sendResendEmail } from "@/lib/email/deadline-reminder"
import { buildKnowledgeSyncAlertEmail } from "@/lib/email/knowledge-sync-alert"
import { conditionalFetch } from "@/lib/knowledge/http"
import { extractWatchRows } from "@/lib/knowledge/index-extract"
import { trySaveKnowledgePdfSnapshot } from "@/lib/knowledge/snapshots"
import type {
  KnowledgeDocument,
  KnowledgeSyncAlertKind,
  KnowledgeSyncStatus,
} from "@/types/database"

export type SyncOneResult = {
  documentId: string
  title: string
  status: KnowledgeSyncStatus
  message?: string
  changed?: boolean
  newItemCount?: number
}

/** 前回比でサイズがこの倍率を超えたら疑い */
const SIZE_RATIO_SUSPICIOUS = 3
/** 絶対バイト数がこの値未満なら異常の可能性 */
const MIN_PDF_BYTES = 500

type ServiceClient = ReturnType<typeof createServiceClient>

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
  kind: KnowledgeSyncAlertKind
  message: string
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
    const result = await sendResendEmail({
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
    if (!result.ok) {
      console.error("[knowledge-sync] email_failed", {
        kind: opts.kind,
        error: result.error?.slice(0, 120),
      })
    }
  }
}

/**
 * 1件の knowledge_documents を監視同期する（service role）。
 * watch_kind=file: PDFハッシュ比較 / index: 一覧行の item_key 差分
 */
export async function syncKnowledgeDocument(
  doc: KnowledgeDocument,
  service: ServiceClient = createServiceClient()
): Promise<SyncOneResult> {
  const sourceUrl = doc.source_url?.trim()
  if (!sourceUrl) {
    return {
      documentId: doc.id,
      title: doc.title,
      status: "failed",
      message: "監視用のURL（source_url）が未設定です。",
    }
  }

  const watchKind = doc.watch_kind ?? "file"
  if (watchKind === "index") {
    return syncIndexDocument(doc, sourceUrl, service)
  }
  return syncFileDocument(doc, sourceUrl, service)
}

async function syncFileDocument(
  doc: KnowledgeDocument,
  sourceUrl: string,
  service: ServiceClient
): Promise<SyncOneResult> {
  const now = new Date().toISOString()
  const fetched = await conditionalFetch(sourceUrl, {
    etag: doc.etag,
    lastModified: doc.last_modified,
    accept: "application/pdf,*/*",
  })

  if (fetched.kind === "not_modified") {
    await service
      .from("knowledge_documents")
      .update({
        last_checked_at: now,
        last_ok_at: now,
        last_sync_status: "unchanged",
        last_error: null,
      })
      .eq("id", doc.id)
    return {
      documentId: doc.id,
      title: doc.title,
      status: "unchanged",
      changed: false,
      message: "変更なし（304 Not Modified）。",
    }
  }

  if (fetched.kind === "error") {
    await markFailed(service, doc, now, fetched.message)
    return {
      documentId: doc.id,
      title: doc.title,
      status: "failed",
      message: fetched.message,
    }
  }

  const buf = await fetched.response.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const contentType = fetched.response.headers.get("content-type")
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

  const cacheFields = {
    etag: fetched.etag,
    last_modified: fetched.lastModified,
  }

  const pdfBuffer = Buffer.from(buf)

  if (doc.content_hash && doc.content_hash === hash) {
    // ハッシュ一致でもスナップショット欠落時は補完（既存台帳の初回取得など）
    await trySaveKnowledgePdfSnapshot({
      service,
      knowledgeDocumentId: doc.id,
      contentHash: hash,
      pdfBuffer,
      sourceUrlAtCapture: sourceUrl,
    })

    await service
      .from("knowledge_documents")
      .update({
        last_checked_at: now,
        last_ok_at: now,
        last_sync_status: "unchanged",
        last_error: null,
        content_bytes: byteLength,
        ...cacheFields,
      })
      .eq("id", doc.id)

    return {
      documentId: doc.id,
      title: doc.title,
      status: "unchanged",
      changed: false,
    }
  }

  // 初回ハッシュ確定 or 内容変更: 変更後テキストをスナップショット保存
  await trySaveKnowledgePdfSnapshot({
    service,
    knowledgeDocumentId: doc.id,
    contentHash: hash,
    pdfBuffer,
    sourceUrlAtCapture: sourceUrl,
  })

  const difyId = `dify-sync-${hash.slice(0, 12)}`
  await service
    .from("knowledge_documents")
    .update({
      content_hash: hash,
      content_bytes: byteLength,
      last_checked_at: now,
      last_ok_at: now,
      last_sync_status: "ok",
      last_error: null,
      dify_document_id: difyId,
      updated_at: now,
      ...cacheFields,
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

async function syncIndexDocument(
  doc: KnowledgeDocument,
  sourceUrl: string,
  service: ServiceClient
): Promise<SyncOneResult> {
  const now = new Date().toISOString()
  const selector = doc.css_selector?.trim()
  if (!selector) {
    const message =
      "一覧監視（index）には CSSセレクタが必要です。登録内容をご確認ください。"
    await markFailed(service, doc, now, message)
    return {
      documentId: doc.id,
      title: doc.title,
      status: "failed",
      message,
    }
  }

  const fetched = await conditionalFetch(sourceUrl, {
    etag: doc.etag,
    lastModified: doc.last_modified,
    accept: "text/html,application/xhtml+xml,*/*",
  })

  if (fetched.kind === "not_modified") {
    await service
      .from("knowledge_documents")
      .update({
        last_checked_at: now,
        last_ok_at: now,
        last_sync_status: "unchanged",
        last_error: null,
      })
      .eq("id", doc.id)
    return {
      documentId: doc.id,
      title: doc.title,
      status: "unchanged",
      changed: false,
      message: "変更なし（304 Not Modified）。",
    }
  }

  if (fetched.kind === "error") {
    await markFailed(service, doc, now, fetched.message)
    return {
      documentId: doc.id,
      title: doc.title,
      status: "failed",
      message: fetched.message,
    }
  }

  const html = await fetched.response.text()
  const rows = extractWatchRows(html, selector, sourceUrl)

  // 不変条件: 抽出0件は「新着なし」ではなくセレクタ破損
  if (rows.length === 0) {
    const message = `抽出0件です。サイト改修の可能性があります。セレクタをご確認ください: ${selector}`
    await markSelectorBroken(service, doc, now, message)
    return {
      documentId: doc.id,
      title: doc.title,
      status: "selector_broken",
      message,
    }
  }

  const { data: knownRows, error: knownError } = await service
    .from("knowledge_watch_items")
    .select("item_key")
    .eq("knowledge_document_id", doc.id)

  if (knownError) {
    const message = `既知記事の取得に失敗しました: ${knownError.message}`
    await markFailed(service, doc, now, message)
    return {
      documentId: doc.id,
      title: doc.title,
      status: "failed",
      message,
    }
  }

  const known = new Set((knownRows ?? []).map((r) => r.item_key as string))
  const isBaseline = known.size === 0
  const newcomers = rows.filter((r) => !known.has(r.item_key))

  if (newcomers.length > 0) {
    const { error: insertError } = await service
      .from("knowledge_watch_items")
      .upsert(
        newcomers.map((r) => ({
          knowledge_document_id: doc.id,
          item_key: r.item_key,
          title: r.title.slice(0, 500),
          href: r.href.slice(0, 2000),
          first_seen_at: now,
        })),
        { onConflict: "knowledge_document_id,item_key", ignoreDuplicates: true }
      )

    if (insertError) {
      const message = `記事キーの保存に失敗しました: ${insertError.message}`
      await markFailed(service, doc, now, message)
      return {
        documentId: doc.id,
        title: doc.title,
        status: "failed",
        message,
      }
    }
  }

  // 初回はベースライン投入のみ（大量お知らせを避ける）
  if (!isBaseline && newcomers.length > 0) {
    const preview = newcomers
      .slice(0, 3)
      .map((r) => r.title)
      .join(" / ")
    const more =
      newcomers.length > 3 ? ` ほか${newcomers.length - 3}件` : ""
    await service.from("app_announcements").insert({
      title: `「${doc.title}」に新着が検知された可能性があります`,
      body: `新着 ${newcomers.length}件の可能性があります（${preview}${more}）。内容をご確認ください。`,
      kind: "knowledge_update",
      knowledge_document_id: doc.id,
    })
  }

  await service
    .from("knowledge_documents")
    .update({
      last_checked_at: now,
      last_ok_at: now,
      last_sync_status:
        !isBaseline && newcomers.length > 0 ? "ok" : "unchanged",
      last_error: null,
      etag: fetched.etag,
      last_modified: fetched.lastModified,
      updated_at: now,
    })
    .eq("id", doc.id)

  if (isBaseline) {
    return {
      documentId: doc.id,
      title: doc.title,
      status: "unchanged",
      changed: false,
      newItemCount: newcomers.length,
      message: `初回ベースラインとして ${newcomers.length}件の記事キーを登録しました（お知らせは作成していません）。`,
    }
  }

  if (newcomers.length === 0) {
    return {
      documentId: doc.id,
      title: doc.title,
      status: "unchanged",
      changed: false,
      newItemCount: 0,
    }
  }

  return {
    documentId: doc.id,
    title: doc.title,
    status: "ok",
    changed: true,
    newItemCount: newcomers.length,
    message: `新着 ${newcomers.length}件を検知し、お知らせを作成しました。`,
  }
}

async function markFailed(
  service: ServiceClient,
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
    kind: "failed" satisfies KnowledgeSyncAlertKind,
    message,
    status: "open",
  })

  await notifyOperators({
    title: doc.title,
    kind: "failed",
    message,
  })
}

async function markSuspicious(
  service: ServiceClient,
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
  })
}

async function markSelectorBroken(
  service: ServiceClient,
  doc: KnowledgeDocument,
  now: string,
  message: string
) {
  await service
    .from("knowledge_documents")
    .update({
      last_checked_at: now,
      last_sync_status: "selector_broken",
      last_error: message,
    })
    .eq("id", doc.id)

  await service.from("knowledge_sync_alerts").insert({
    knowledge_document_id: doc.id,
    kind: "selector_broken",
    message,
    status: "open",
  })

  await notifyOperators({
    title: doc.title,
    kind: "selector_broken",
    message,
  })
}

/**
 * active かつ source_url がある全件を同期。
 * 1件の失敗は他件を止めない。
 */
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
    try {
      results.push(await syncKnowledgeDocument(doc, service))
    } catch (err) {
      const message =
        err instanceof Error
          ? `予期しないエラー: ${err.message.slice(0, 200)}`
          : "予期しないエラーが発生しました。"
      console.error("[knowledge-sync] continue_after_error", {
        documentId: doc.id,
        message: message.slice(0, 200),
      })
      try {
        await markFailed(service, doc, new Date().toISOString(), message)
      } catch (markErr) {
        console.error("[knowledge-sync] mark_failed_also_failed", {
          documentId: doc.id,
          error:
            markErr instanceof Error
              ? markErr.message.slice(0, 120)
              : "unknown",
        })
      }
      results.push({
        documentId: doc.id,
        title: doc.title,
        status: "failed",
        message,
      })
    }
  }

  return { results, checked: withUrl.length }
}
