/**
 * 変更検知時の AI 差分整理 → 承認待ちドラフト作成
 * - Gemini 成功: 対比案 + 引用実在チェック
 * - 未設定/失敗: AI整理なしドラフト（見落とし防止）
 */

import { createServiceClient } from "@/lib/supabase/server"
import {
  generateGeminiJson,
  isGeminiConfigured,
} from "@/lib/knowledge/gemini"
import {
  getSnapshotByHash,
  readSnapshotText,
} from "@/lib/knowledge/snapshots"
import type {
  KnowledgeDocument,
  KnowledgeDocumentChangeDraft,
  KnowledgeDocumentSnapshot,
} from "@/types/database"

type ServiceClient = ReturnType<typeof createServiceClient>

/** Gemini に渡す各テキストの上限（文字） */
const GEMINI_INPUT_MAX_CHARS = 100_000

export type KnowledgeChangeItem = {
  change_type: "改正" | "追加" | "削除" | string
  before_text: string
  after_text: string
  quote_before: string
  quote_after: string
  confidence: "high" | "medium" | "low" | string
  quote_before_verified?: boolean
  quote_after_verified?: boolean
}

export type QuoteVerifyResult = {
  changes: KnowledgeChangeItem[]
  /** 検証対象があった場合の一致率。対象0件は 1 */
  quoteVerifiedRatio: number
  needsReview: boolean
}

function normalizeForQuoteMatch(s: string): string {
  return s.replace(/\s+/g, "").trim()
}

export function quoteExistsInSource(quote: string, source: string): boolean {
  const q = normalizeForQuoteMatch(quote)
  if (!q) return true
  return normalizeForQuoteMatch(source).includes(q)
}

/**
 * quote_before / quote_after が原文に含まれるか照合。
 * 空引用は対象外。対象0件なら ratio=1。
 */
export function verifyChangeQuotes(
  changes: KnowledgeChangeItem[],
  beforeText: string,
  afterText: string
): QuoteVerifyResult {
  let checked = 0
  let matched = 0
  const annotated = changes.map((c) => {
    const next = { ...c }
    if (c.quote_before?.trim()) {
      checked += 1
      const ok = quoteExistsInSource(c.quote_before, beforeText)
      next.quote_before_verified = ok
      if (ok) matched += 1
    }
    if (c.quote_after?.trim()) {
      checked += 1
      const ok = quoteExistsInSource(c.quote_after, afterText)
      next.quote_after_verified = ok
      if (ok) matched += 1
    }
    return next
  })

  const ratio = checked === 0 ? 1 : matched / checked
  return {
    changes: annotated,
    quoteVerifiedRatio: Math.round(ratio * 1000) / 1000,
    needsReview: ratio < 1,
  }
}

function clipForGemini(text: string): string {
  if (text.length <= GEMINI_INPUT_MAX_CHARS) return text
  return `${text.slice(0, GEMINI_INPUT_MAX_CHARS)}\n\n…（以降は入力上限のため省略）`
}

function buildDiffPrompt(beforeText: string, afterText: string): string {
  return `あなたは介護保険・運営指導の行政マニュアル改定を整理する専門家です。
以下の「変更前」「変更後」テキストを比較し、JSONのみで答えてください。
断定は避け、事実の対比に徹してください。

必須スキーマ:
{
  "summary": "この変更の要点（3文以内・丁寧語）",
  "changes": [
    {
      "change_type": "改正" | "追加" | "削除",
      "before_text": "変更前の該当箇所の抜粋",
      "after_text": "変更後の該当箇所の抜粋",
      "quote_before": "変更前原文からの短い引用（原文に実在する文字列）",
      "quote_after": "変更後原文からの短い引用（原文に実在する文字列）",
      "confidence": "high" | "medium" | "low"
    }
  ]
}

ルール:
- quote_* は必ず原文に含まれる文字列のみ（捏造禁止）
- 重要な変更を最大15件まで
- 変更が読み取れない場合は changes を空配列にし、summary でその旨を述べる

【変更前】
${clipForGemini(beforeText)}

【変更後】
${clipForGemini(afterText)}
`
}

function parseGeminiChanges(raw: string): {
  summary: string
  changes: KnowledgeChangeItem[]
} | null {
  try {
    const parsed = JSON.parse(raw) as {
      summary?: unknown
      changes?: unknown
    }
    const summary =
      typeof parsed.summary === "string" ? parsed.summary.trim() : ""
    const list = Array.isArray(parsed.changes) ? parsed.changes : []
    const changes: KnowledgeChangeItem[] = list
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .slice(0, 15)
      .map((c) => ({
        change_type: String(c.change_type ?? "改正"),
        before_text: String(c.before_text ?? ""),
        after_text: String(c.after_text ?? ""),
        quote_before: String(c.quote_before ?? ""),
        quote_after: String(c.quote_after ?? ""),
        confidence: String(c.confidence ?? "medium"),
      }))
    return {
      summary:
        summary ||
        "マニュアル内容に更新があった可能性があります。詳細をご確認ください。",
      changes,
    }
  } catch {
    return null
  }
}

async function insertDraft(
  service: ServiceClient,
  row: {
    knowledge_document_id: string
    before_snapshot_id: string | null
    after_snapshot_id: string | null
    ai_summary: string | null
    changes: KnowledgeChangeItem[]
    quote_verified_ratio: number | null
    ai_organized: boolean
  }
): Promise<KnowledgeDocumentChangeDraft> {
  const { data, error } = await service
    .from("knowledge_document_change_drafts")
    .insert({
      knowledge_document_id: row.knowledge_document_id,
      before_snapshot_id: row.before_snapshot_id,
      after_snapshot_id: row.after_snapshot_id,
      ai_summary: row.ai_summary,
      changes: row.changes,
      quote_verified_ratio: row.quote_verified_ratio,
      ai_organized: row.ai_organized,
      status: "pending",
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "差分ドラフトの保存に失敗しました。")
  }
  return data as KnowledgeDocumentChangeDraft
}

async function createAiUnavailableDraft(
  service: ServiceClient,
  opts: {
    documentId: string
    beforeSnapshotId: string | null
    afterSnapshotId: string | null
    reason: string
  }
): Promise<KnowledgeDocumentChangeDraft> {
  return insertDraft(service, {
    knowledge_document_id: opts.documentId,
    before_snapshot_id: opts.beforeSnapshotId,
    after_snapshot_id: opts.afterSnapshotId,
    ai_summary: `AIによる差分整理ができませんでした（${opts.reason}）。変更前後の原文スナップショットをご確認ください。`,
    changes: [],
    quote_verified_ratio: null,
    ai_organized: false,
  })
}

/**
 * SHA-256 変更検知直後に呼ぶ。
 * 初回ハッシュ確定（before なし）ではドラフトを作らない。
 */
export async function createChangeDraftOnHashChange(opts: {
  service: ServiceClient
  doc: KnowledgeDocument
  previousContentHash: string
  afterSnapshot: KnowledgeDocumentSnapshot
  afterText?: string
}): Promise<KnowledgeDocumentChangeDraft | null> {
  const { service, doc, previousContentHash, afterSnapshot } = opts

  // 同一 after スナップショットの pending があれば重複作成しない
  const { data: existingPending } = await service
    .from("knowledge_document_change_drafts")
    .select("id")
    .eq("knowledge_document_id", doc.id)
    .eq("after_snapshot_id", afterSnapshot.id)
    .eq("status", "pending")
    .maybeSingle()

  if (existingPending) {
    return null
  }

  let beforeSnapshot = await getSnapshotByHash(
    service,
    doc.id,
    previousContentHash
  )
  let beforeText = ""
  if (beforeSnapshot) {
    try {
      beforeText = await readSnapshotText(service, beforeSnapshot)
    } catch (err) {
      console.error("[knowledge-draft] before_text_read_failed", {
        documentId: doc.id,
        error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
      })
      beforeSnapshot = null
    }
  }

  let afterText = opts.afterText
  if (afterText == null) {
    try {
      afterText = await readSnapshotText(service, afterSnapshot)
    } catch (err) {
      console.error("[knowledge-draft] after_text_read_failed", {
        documentId: doc.id,
        error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
      })
      return createAiUnavailableDraft(service, {
        documentId: doc.id,
        beforeSnapshotId: beforeSnapshot?.id ?? null,
        afterSnapshotId: afterSnapshot.id,
        reason: "変更後テキストの読取失敗",
      })
    }
  }

  if (!beforeSnapshot || !beforeText) {
    return createAiUnavailableDraft(service, {
      documentId: doc.id,
      beforeSnapshotId: beforeSnapshot?.id ?? null,
      afterSnapshotId: afterSnapshot.id,
      reason: "変更前スナップショット未取得",
    })
  }

  if (!isGeminiConfigured()) {
    return createAiUnavailableDraft(service, {
      documentId: doc.id,
      beforeSnapshotId: beforeSnapshot.id,
      afterSnapshotId: afterSnapshot.id,
      reason: "GEMINI_API_KEY 未設定",
    })
  }

  const gemini = await generateGeminiJson(
    buildDiffPrompt(beforeText, afterText)
  )
  if (!gemini.ok) {
    return createAiUnavailableDraft(service, {
      documentId: doc.id,
      beforeSnapshotId: beforeSnapshot.id,
      afterSnapshotId: afterSnapshot.id,
      reason: gemini.error.slice(0, 80),
    })
  }

  const parsed = parseGeminiChanges(gemini.text)
  if (!parsed) {
    return createAiUnavailableDraft(service, {
      documentId: doc.id,
      beforeSnapshotId: beforeSnapshot.id,
      afterSnapshotId: afterSnapshot.id,
      reason: "Gemini応答のJSON解析失敗",
    })
  }

  const verified = verifyChangeQuotes(
    parsed.changes,
    beforeText,
    afterText
  )

  return insertDraft(service, {
    knowledge_document_id: doc.id,
    before_snapshot_id: beforeSnapshot.id,
    after_snapshot_id: afterSnapshot.id,
    ai_summary: parsed.summary,
    changes: verified.changes,
    quote_verified_ratio: verified.quoteVerifiedRatio,
    ai_organized: true,
  })
}

export async function tryCreateChangeDraftOnHashChange(
  opts: Parameters<typeof createChangeDraftOnHashChange>[0]
): Promise<KnowledgeDocumentChangeDraft | null> {
  try {
    return await createChangeDraftOnHashChange(opts)
  } catch (err) {
    console.error("[knowledge-draft] create_failed", {
      documentId: opts.doc.id,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    })
    return null
  }
}
