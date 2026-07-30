/**
 * 監査カテゴリ向け関連PDFの候補マッチング（キーワード検索）
 */

import type { AuditCategoryDef } from "@/lib/rule-engine/audit-categories"

export type DiscoverableSource = {
  id: string
  title: string
  parent_page_url: string | null
  direct_file_url: string | null
  memo: string | null
  jurisdiction_id: string
}

export function sourceMatchesAuditCategoryKeywords(
  source: Pick<DiscoverableSource, "title" | "memo">,
  category: Pick<AuditCategoryDef, "title" | "titleKeywords">
): boolean {
  const hay = `${source.title}\n${source.memo ?? ""}`.toLowerCase()
  if (!hay.trim()) return false

  const keywords = [
    ...category.titleKeywords,
    ...category.title.split(/[⇔⇄↔\/／・\s]+/).filter((w) => w.length >= 2),
  ]

  return keywords.some((kw) => hay.includes(kw.toLowerCase()))
}

/**
 * 未リンクの公開情報から、カテゴリに合いそうな候補を抽出する。
 * PDF直リンクがあるものを優先し、なければ親URLありも候補にする。
 */
export function pickDiscoverableSources(input: {
  sources: DiscoverableSource[]
  category: AuditCategoryDef
  alreadyLinkedSourceIds: Set<string>
  rejectedSourceIds: Set<string>
}): DiscoverableSource[] {
  return input.sources.filter((s) => {
    if (input.alreadyLinkedSourceIds.has(s.id)) return false
    if (input.rejectedSourceIds.has(s.id)) return false
    const hasUrl = Boolean(
      s.direct_file_url?.trim() || s.parent_page_url?.trim()
    )
    if (!hasUrl) return false
    return sourceMatchesAuditCategoryKeywords(s, input.category)
  })
}

export function primaryCandidateUrl(
  row: Pick<DiscoverableSource, "direct_file_url" | "parent_page_url">
): string | null {
  return row.direct_file_url?.trim() || row.parent_page_url?.trim() || null
}
