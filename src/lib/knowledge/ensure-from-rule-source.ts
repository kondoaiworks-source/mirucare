import { syncKnowledgeDocument } from "@/lib/knowledge/sync"
import type {
  JurisdictionLevel,
  KnowledgeDocument,
  RuleJurisdiction,
  RuleJurisdictionLevel,
  RuleSource,
} from "@/types/database"
import type { SupabaseClient } from "@supabase/supabase-js"

type ServiceClient = SupabaseClient

export type EnsureFromRuleSourceResult = {
  knowledgeDocumentId: string | null
  created: boolean
  synced: boolean
  /** 監視を始めた／継続したか（PDF URLがあるとき） */
  monitoringReady: boolean
  message: string
}

function mapJurisdictionLevel(
  level: RuleJurisdictionLevel
): JurisdictionLevel {
  if (level === "national") return "国"
  if (level === "prefecture") return "都道府県"
  return "市区町村"
}

function regionNameFor(
  level: JurisdictionLevel,
  jurisdiction: Pick<
    RuleJurisdiction,
    "name" | "municipality_name" | "prefecture_name"
  >
): string | null {
  if (level === "国") return null
  if (level === "都道府県") {
    return jurisdiction.prefecture_name?.trim() || jurisdiction.name
  }
  return (
    jurisdiction.municipality_name?.trim() ||
    jurisdiction.name.trim() ||
    null
  )
}

function resolveMonitorUrl(source: Pick<
  RuleSource,
  "direct_file_url" | "official_url" | "parent_page_url" | "file_type"
>): { url: string | null; isPdfLikely: boolean } {
  const direct = source.direct_file_url?.trim() || null
  const official = source.official_url?.trim() || null
  const parent = source.parent_page_url?.trim() || null
  const url = direct || official || parent
  if (!url) return { url: null, isPdfLikely: false }

  const lower = url.toLowerCase()
  const isPdfLikely =
    source.file_type === "pdf" ||
    Boolean(direct) ||
    lower.includes(".pdf") ||
    lower.includes("application/pdf")

  return { url, isPdfLikely }
}

/**
 * 参照URL（rule_sources）から手動管理を確保し、PDFなら初回同期する。
 * 既に knowledge_document_id があれば再利用。同一 source_url の台帳があれば紐付ける。
 */
export async function ensureKnowledgeDocumentFromRuleSource(
  service: ServiceClient,
  ruleSourceId: string
): Promise<EnsureFromRuleSourceResult> {
  const { data: row, error } = await service
    .from("rule_sources")
    .select(
      `
      id,
      title,
      direct_file_url,
      official_url,
      parent_page_url,
      file_type,
      knowledge_document_id,
      rule_jurisdictions (
        id,
        name,
        level,
        municipality_name,
        prefecture_name
      )
    `
    )
    .eq("id", ruleSourceId)
    .maybeSingle()

  if (error || !row) {
    return {
      knowledgeDocumentId: null,
      created: false,
      synced: false,
      monitoringReady: false,
      message: "参照URLが見つかりませんでした。",
    }
  }

  const source = row as unknown as RuleSource & {
    rule_jurisdictions:
      | Pick<
          RuleJurisdiction,
          "id" | "name" | "level" | "municipality_name" | "prefecture_name"
        >
      | Pick<
          RuleJurisdiction,
          "id" | "name" | "level" | "municipality_name" | "prefecture_name"
        >[]
      | null
  }

  const jurRaw = source.rule_jurisdictions
  const jurisdiction = Array.isArray(jurRaw) ? jurRaw[0] : jurRaw
  if (!jurisdiction) {
    return {
      knowledgeDocumentId: null,
      created: false,
      synced: false,
      monitoringReady: false,
      message: "自治体情報が見つかりませんでした。",
    }
  }

  const { url: monitorUrl, isPdfLikely } = resolveMonitorUrl(source)
  if (!monitorUrl) {
    return {
      knowledgeDocumentId: source.knowledge_document_id,
      created: false,
      synced: false,
      monitoringReady: false,
      message: "URLが未設定のため、監視台帳は作成していません。",
    }
  }

  const jurisdictionLevel = mapJurisdictionLevel(jurisdiction.level)
  const regionName = regionNameFor(jurisdictionLevel, jurisdiction)
  const year = new Date().getFullYear()
  const title = source.title.trim() || "無題のマニュアル"

  let documentId = source.knowledge_document_id
  let created = false

  if (documentId) {
    await service
      .from("knowledge_documents")
      .update({
        title,
        source_url: monitorUrl,
        jurisdiction_level: jurisdictionLevel,
        region_name: regionName,
        status: "active",
      })
      .eq("id", documentId)
  } else {
    const { data: existingByUrl } = await service
      .from("knowledge_documents")
      .select("id")
      .eq("source_url", monitorUrl)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()

    if (existingByUrl?.id) {
      documentId = existingByUrl.id as string
      await service
        .from("knowledge_documents")
        .update({
          title,
          jurisdiction_level: jurisdictionLevel,
          region_name: regionName,
        })
        .eq("id", documentId)
    } else {
      const { data: inserted, error: insertError } = await service
        .from("knowledge_documents")
        .insert({
          title,
          jurisdiction_level: jurisdictionLevel,
          region_name: regionName,
          applicable_year: year,
          source_url: monitorUrl,
          watch_kind: "file",
          status: "active",
          dify_document_id: null,
          last_sync_status: null,
        })
        .select("id")
        .single()

      if (insertError || !inserted) {
        return {
          knowledgeDocumentId: null,
          created: false,
          synced: false,
          monitoringReady: false,
          message:
            "手動管理の自動作成に失敗しました。監視トラブルから「手動管理」を開いて登録してください。",
        }
      }
      documentId = inserted.id as string
      created = true
    }

    await service
      .from("rule_sources")
      .update({ knowledge_document_id: documentId })
      .eq("id", ruleSourceId)
  }

  if (!isPdfLikely) {
    return {
      knowledgeDocumentId: documentId,
      created,
      synced: false,
      monitoringReady: false,
      message: created
        ? "参照URLを台帳に登録しました。PDFの直リンクがあると自動監視が始まります。"
        : "台帳と紐付けました。PDFの直リンクがあると自動監視が始まります。",
    }
  }

  const { data: docRow } = await service
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .single()

  if (!docRow) {
    return {
      knowledgeDocumentId: documentId,
      created,
      synced: false,
      monitoringReady: true,
      message: "台帳は用意できましたが、初回同期に失敗しました。",
    }
  }

  const syncResult = await syncKnowledgeDocument(
    docRow as KnowledgeDocument,
    service
  )
  const synced =
    syncResult.status === "ok" ||
    syncResult.status === "unchanged" ||
    syncResult.changed === true

  return {
    knowledgeDocumentId: documentId,
    created,
    synced,
    monitoringReady: true,
    message: synced
      ? created
        ? "参照URLを登録し、手動管理の監視を開始しました。"
        : "手動管理の監視を更新しました。"
      : `台帳は用意しましたが、初回取得に問題があります（${syncResult.message}）。監視トラブルの「同期の結果」でご確認ください。`,
  }
}
