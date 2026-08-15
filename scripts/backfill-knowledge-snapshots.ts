/**
 * 既存 knowledge_documents（file 監視）の初回スナップショットを遡及作成する。
 *
 * 前提:
 * - マイグレーション 20260719080000_knowledge_change_drafts.sql 適用済み
 * - Storage バケット knowledge-snapshots（private）が存在する
 * - .env.local に Supabase URL / SERVICE_ROLE_KEY
 *
 *   npm run backfill:knowledge-snapshots
 */
import { createHash } from "crypto"
import { createClient } from "@supabase/supabase-js"
import { conditionalFetch } from "../src/lib/knowledge/http"
import { saveKnowledgePdfSnapshot } from "../src/lib/knowledge/snapshots"
import type { KnowledgeDocument } from "../src/types/database"

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function looksLikePdf(bytes: Uint8Array, contentType: string | null): boolean {
  if (bytes.length >= 4) {
    const header = `${String.fromCharCode(bytes[0]!)}${String.fromCharCode(bytes[1]!)}${String.fromCharCode(bytes[2]!)}${String.fromCharCode(bytes[3]!)}`
    if (header === "%PDF") return true
  }
  if (contentType?.toLowerCase().includes("pdf")) return true
  return false
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  assert(url && key, "Supabase env missing（.env.local を確認）")

  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await service
    .from("knowledge_documents")
    .select("*")
    .eq("status", "active")
    .eq("watch_kind", "file")
    .not("source_url", "is", null)

  if (error?.message?.includes("knowledge_document_snapshots") || error) {
    if (error.message.includes("does not exist") || error.code === "42P01") {
      console.error(
        "FAIL: マイグレーション未適用の可能性があります。20260719080000_knowledge_change_drafts.sql を実行してください。"
      )
      process.exit(1)
    }
  }
  assert(!error, error?.message ?? "query failed")

  const docs = ((data ?? []) as KnowledgeDocument[]).filter((d) =>
    d.source_url?.trim()
  )

  console.log(`対象: ${docs.length}件（active / file / source_url あり）`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (const doc of docs) {
    const sourceUrl = doc.source_url!.trim()
    try {
      if (doc.content_hash) {
        const { data: existing } = await service
          .from("knowledge_document_snapshots")
          .select("id, text_bytes")
          .eq("knowledge_document_id", doc.id)
          .eq("content_hash", doc.content_hash)
          .maybeSingle()
        if (existing && Number(existing.text_bytes) > 0) {
          skipped += 1
          console.log(`SKIP 既存 ${doc.title}`)
          continue
        }
      }

      const fetched = await conditionalFetch(sourceUrl, {
        accept: "application/pdf,*/*",
      })
      if (fetched.kind !== "ok") {
        failed += 1
        console.error(
          `FAIL 取得 ${doc.title}:`,
          fetched.kind === "error" ? fetched.message : fetched.kind
        )
        continue
      }

      const buf = Buffer.from(await fetched.response.arrayBuffer())
      const contentType = fetched.response.headers.get("content-type")
      if (buf.byteLength < 500 || !looksLikePdf(buf, contentType)) {
        failed += 1
        console.error(`FAIL PDF判定 ${doc.title}`)
        continue
      }

      const hash = createHash("sha256").update(buf).digest("hex")
      const result = await saveKnowledgePdfSnapshot({
        service,
        knowledgeDocumentId: doc.id,
        contentHash: hash,
        pdfBuffer: buf,
        sourceUrlAtCapture: sourceUrl,
      })

      if (!doc.content_hash || doc.content_hash !== hash) {
        await service
          .from("knowledge_documents")
          .update({
            content_hash: hash,
            content_bytes: buf.byteLength,
            etag: fetched.etag,
            last_modified: fetched.lastModified,
            last_checked_at: new Date().toISOString(),
            last_ok_at: new Date().toISOString(),
            last_sync_status: "ok",
            last_error: null,
          })
          .eq("id", doc.id)
      }

      if (result.created) {
        created += 1
        console.log(
          `OK 作成 ${doc.title}${result.isTruncated ? " (truncated)" : ""}`
        )
      } else {
        skipped += 1
        console.log(`SKIP 既存 ${doc.title}`)
      }
    } catch (err) {
      failed += 1
      console.error(
        `FAIL ${doc.title}:`,
        err instanceof Error ? err.message.slice(0, 200) : err
      )
    }
  }

  console.log(
    JSON.stringify({ created, skipped, failed, total: docs.length }, null, 2)
  )
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
