"use server"

import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import {
  documentMatchesRuleScope,
  type CheckRuleManageContext,
} from "@/lib/rule-engine/check-rule-scope"
import type { KnowledgeDocument, KnowledgeSyncStatus } from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

export type KnowledgeDocumentForPropose = {
  id: string
  title: string
  region_name: string | null
  jurisdiction_level: string | null
  content_hash: string | null
  source_url: string | null
  last_sync_status: KnowledgeSyncStatus | null
  status: string
  hasTextSnapshot: boolean
  layer: "national" | "prefecture" | "city" | "other"
}

function layerFromJurisdiction(
  level: string | null
): KnowledgeDocumentForPropose["layer"] {
  if (level === "国") return "national"
  if (level === "都道府県") return "prefecture"
  if (level === "市区町村") return "city"
  return "other"
}

/**
 * ルール管理用：判定ルール案を生成できる台帳資料一覧。
 */
export async function listKnowledgeDocumentsForProposeAction(input?: {
  scopeKind?: CheckRuleManageContext["scopeKind"]
  cityName?: string
}): Promise<
  ActionResult<{ documents: KnowledgeDocumentForPropose[] }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { data, error } = await op.service
    .from("knowledge_documents")
    .select("*")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(200)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  const docs = (data ?? []) as KnowledgeDocument[]
  const withSnap = new Set<string>()

  if (docs.length > 0) {
    const { data: snapRows } = await op.service
      .from("knowledge_document_snapshots")
      .select("knowledge_document_id")
      .in(
        "knowledge_document_id",
        docs.map((d) => d.id)
      )
      .limit(500)
    for (const row of snapRows ?? []) {
      withSnap.add(row.knowledge_document_id as string)
    }
  }

  const mapped = docs.map((d) => ({
    id: d.id,
    title: d.title,
    region_name: d.region_name ?? null,
    jurisdiction_level: d.jurisdiction_level ?? null,
    content_hash: d.content_hash ?? null,
    source_url: d.source_url ?? null,
    last_sync_status: d.last_sync_status ?? null,
    status: d.status,
    hasTextSnapshot: withSnap.has(d.id),
    layer: layerFromJurisdiction(d.jurisdiction_level ?? null),
  }))

  const scopeKind = input?.scopeKind
  const filtered = scopeKind
    ? mapped.filter((d) =>
        documentMatchesRuleScope(d, {
          scopeKind,
          cityName: input?.cityName,
        })
      )
    : mapped

  return {
    ok: true,
    data: {
      documents: filtered,
    },
  }
}
