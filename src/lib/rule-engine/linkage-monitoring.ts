import type { KnowledgeDocument, KnowledgeSyncAlert } from "@/types/database"

/** 公開情報監視の一覧表示用結果 */
export type LinkageMonitorResult = "ok" | "ng" | "diff"

export type LinkageMonitorEvent = {
  id: string
  checkedAt: string
  title: string
  result: LinkageMonitorResult
  documentId: string | null
  alertId?: string
  draftId?: string
  detail: string
  sourceUrl?: string | null
  jurisdictionLevel?: string | null
  regionName?: string | null
}

export type PendingDraftForMonitor = {
  id: string
  created_at: string
  ai_summary: string | null
  knowledge_documents: {
    id: string
    title: string
    source_url?: string | null
    jurisdiction_level?: string | null
    region_name?: string | null
  } | null
}

/** 監視状況から作り直すときの確認記録（原文確認の記録として残す） */
export const MONITOR_REMAKE_REVIEW_REASON =
  "監視状況で公式PDFの更新を確認し、ルールブックを作り直します。"

function normalizeJoined<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * 同期結果・未解消アラート・差分ドラフトから監視状況リストを組み立てる。
 * 新しい日時順。同じ資料の重複は、優先度 NG > 差分あり > OK で1件に寄せる。
 */
export function buildLinkageMonitorEvents(input: {
  documents: Array<
    Pick<
      KnowledgeDocument,
      | "id"
      | "title"
      | "last_sync_status"
      | "last_checked_at"
      | "last_error"
      | "status"
    > & {
      source_url?: string | null
      jurisdiction_level?: string | null
      region_name?: string | null
    }
  >
  alerts: KnowledgeSyncAlert[]
  drafts: PendingDraftForMonitor[]
}): LinkageMonitorEvent[] {
  const byDoc = new Map<string, LinkageMonitorEvent>()
  const orphan: LinkageMonitorEvent[] = []

  const rank = (r: LinkageMonitorResult) =>
    r === "ng" ? 3 : r === "diff" ? 2 : 1

  function mergeMeta(
    primary: LinkageMonitorEvent,
    secondary: LinkageMonitorEvent
  ): LinkageMonitorEvent {
    return {
      ...primary,
      draftId: primary.draftId ?? secondary.draftId,
      alertId: primary.alertId ?? secondary.alertId,
      sourceUrl: primary.sourceUrl ?? secondary.sourceUrl,
      jurisdictionLevel:
        primary.jurisdictionLevel ?? secondary.jurisdictionLevel,
      regionName: primary.regionName ?? secondary.regionName,
    }
  }

  function upsert(event: LinkageMonitorEvent) {
    if (!event.documentId) {
      orphan.push(event)
      return
    }
    const prev = byDoc.get(event.documentId)
    if (!prev) {
      byDoc.set(event.documentId, event)
      return
    }
    const betterRank = rank(event.result) > rank(prev.result)
    const newer =
      rank(event.result) === rank(prev.result) &&
      event.checkedAt > prev.checkedAt
    if (betterRank || newer) {
      byDoc.set(event.documentId, mergeMeta(event, prev))
    } else {
      byDoc.set(event.documentId, mergeMeta(prev, event))
    }
  }

  for (const a of input.alerts) {
    if (a.status !== "open") continue
    const doc = normalizeJoined(a.knowledge_documents)
    upsert({
      id: `alert:${a.id}`,
      checkedAt: a.created_at,
      title: doc?.title ?? "（マニュアル不明）",
      result: "ng",
      documentId: a.knowledge_document_id ?? doc?.id ?? null,
      alertId: a.id,
      detail: a.message,
      jurisdictionLevel: doc?.jurisdiction_level,
      regionName: doc?.region_name,
    })
  }

  for (const d of input.drafts) {
    const doc = d.knowledge_documents
    upsert({
      id: `draft:${d.id}`,
      checkedAt: d.created_at,
      title: doc?.title ?? "（マニュアル不明）",
      result: "diff",
      documentId: doc?.id ?? null,
      draftId: d.id,
      detail:
        d.ai_summary?.trim() ||
        "公式PDFの内容が変わった可能性があります。原文を確認し、ルールブックを作り直してください。",
      sourceUrl: doc?.source_url,
      jurisdictionLevel: doc?.jurisdiction_level,
      regionName: doc?.region_name,
    })
  }

  for (const doc of input.documents) {
    if (doc.status !== "active") continue
    if (!doc.last_checked_at) continue
    const status = doc.last_sync_status
    if (
      status === "failed" ||
      status === "suspicious" ||
      status === "selector_broken"
    ) {
      upsert({
        id: `doc-ng:${doc.id}`,
        checkedAt: doc.last_checked_at,
        title: doc.title,
        result: "ng",
        documentId: doc.id,
        detail: doc.last_error?.trim() || "自動監視で問題の可能性があります。",
        sourceUrl: doc.source_url,
        jurisdictionLevel: doc.jurisdiction_level,
        regionName: doc.region_name,
      })
      continue
    }
    if (status === "ok") {
      upsert({
        id: `doc-diff:${doc.id}`,
        checkedAt: doc.last_checked_at,
        title: doc.title,
        result: "diff",
        documentId: doc.id,
        detail:
          "公式PDFの更新を検知しました。原文を確認し、ルールブックを作り直してください。確定するまでチェックには使いません。",
        sourceUrl: doc.source_url,
        jurisdictionLevel: doc.jurisdiction_level,
        regionName: doc.region_name,
      })
      continue
    }
    if (status === "unchanged") {
      upsert({
        id: `doc-ok:${doc.id}`,
        checkedAt: doc.last_checked_at,
        title: doc.title,
        result: "ok",
        documentId: doc.id,
        detail: "変更はありませんでした。",
        sourceUrl: doc.source_url,
        jurisdictionLevel: doc.jurisdiction_level,
        regionName: doc.region_name,
      })
    }
  }

  return [...Array.from(byDoc.values()), ...orphan]
    .sort((a, b) =>
      a.checkedAt < b.checkedAt ? 1 : a.checkedAt > b.checkedAt ? -1 : 0
    )
    .map((event) => {
      if (!event.documentId) return event
      const doc = input.documents.find((d) => d.id === event.documentId)
      if (!doc) return event
      return {
        ...event,
        sourceUrl: event.sourceUrl ?? doc.source_url,
        jurisdictionLevel:
          event.jurisdictionLevel ?? doc.jurisdiction_level,
        regionName: event.regionName ?? doc.region_name,
      }
    })
}

export function linkageResultLabel(result: LinkageMonitorResult): string {
  switch (result) {
    case "ok":
      return "OK"
    case "ng":
      return "NG"
    case "diff":
      return "差分あり"
  }
}
