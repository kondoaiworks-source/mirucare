import type {
  RuleHumanReviewStatus,
  RuleMaterialCategory,
  RuleSourceFileType,
  ServiceType,
} from "@/types/database"

/** 対象市区町村の管轄コード（seed・フィルタ用。逗子市は対象外、川崎市を含む） */
export const TARGET_MUNICIPALITY_CODES = [
  "JP-14-14100", // 横浜市
  "JP-14-14130", // 川崎市
  "JP-14-14204", // 鎌倉市
  "JP-14-14205", // 藤沢市
  "JP-14-14207", // 茅ヶ崎市
] as const

export const MATERIAL_CATEGORIES: RuleMaterialCategory[] = [
  "訪問介護",
  "総合事業訪問型",
  "事故報告",
  "過誤申立",
  "加算届",
  "サービスコード表",
]

export const MATERIAL_CATEGORY_LABEL: Record<RuleMaterialCategory, string> = {
  訪問介護: "通常の訪問介護",
  総合事業訪問型: "総合事業（訪問型）",
  事故報告: "事故報告",
  過誤申立: "過誤申立",
  加算届: "加算届",
  サービスコード表: "サービスコード表",
}

export const HUMAN_REVIEW_STATUS_LABEL: Record<RuleHumanReviewStatus, string> = {
  unverified: "未確認",
  verified: "確認済み",
  needs_review: "要再確認",
  outdated: "更新疑い",
}

export const FILE_TYPE_LABEL: Record<RuleSourceFileType, string> = {
  pdf: "PDF",
  html: "HTML",
  doc: "Word",
  xlsx: "Excel",
  zip: "ZIP",
  other: "その他",
}

export const SERVICE_TYPE_OPTIONS: ServiceType[] = [
  "訪問介護",
  "通所介護",
  "その他",
]

export function primarySourceUrl(row: {
  direct_file_url: string | null
  parent_page_url: string | null
  official_url: string | null
}): string | null {
  return (
    row.direct_file_url?.trim() ||
    row.parent_page_url?.trim() ||
    row.official_url?.trim() ||
    null
  )
}

/** 公開情報登録時の自動監視注意（UI・マニュアルで共通） */
export const SOURCE_URL_MONITORING_ALERT_TITLE = "自動監視について"

export const SOURCE_URL_MONITORING_ALERT_BODY =
  "読むPDFの直リンクを置くと、監視状況に載り、ルールブック作成のときに読みます。参考リンク（HTML）はリンク集に置き、ルール抽出には使いません。変わったら人が原文を確認し、作成から作り直してください。自動では本番の物差しを書き換えません。"

/** 直接ファイルURL欄の短い補足 */
export const SOURCE_URL_DIRECT_FILE_HINT =
  "公式PDFの直リンクです。ルールブック作成のときに読みます。一覧ページではなく、ファイルそのもののURLを置いてください。"

/** 本文が無いときの、人によるリンク確認 */
export const SOURCE_URL_FIX_HINT =
  "読むPDFのリンク先を開いて確認してください。規則・様式のPDF直リンクならそのままでよい。ビューアやお知らせ一覧なら、PDFの直URLに直してください。"

export function looksLikeDirectFileUrl(
  url: string | null | undefined,
  fileType?: string | null
): boolean {
  if (fileType === "pdf") return true
  const lower = url?.trim().toLowerCase() ?? ""
  if (!lower) return false
  return lower.includes(".pdf") || lower.includes("application/pdf")
}

/** ルール抽出の対象（読むPDF）。リンク集のHTMLは含めない。 */
export function isReadablePdfSource(source: {
  file_type?: string | null
  direct_file_url?: string | null
  parent_page_url?: string | null
  official_url?: string | null
}): boolean {
  if (source.file_type === "html") return false
  if (source.file_type === "pdf") return true
  const direct = source.direct_file_url?.trim() || null
  if (looksLikeDirectFileUrl(direct, source.file_type)) return true
  const official = source.official_url?.trim() || null
  const parent = source.parent_page_url?.trim() || null
  if (official && parent && official === parent) return false
  return looksLikeDirectFileUrl(official, source.file_type)
}

export function isLinkCollectionSource(source: {
  file_type?: string | null
  direct_file_url?: string | null
  parent_page_url?: string | null
  official_url?: string | null
}): boolean {
  return !isReadablePdfSource(source)
}

/** 読むPDFなのに本文が無いときだけ、リンク修正が必要 */
export function sourceNeedsPdfTextFix(source: {
  file_type?: string | null
  direct_file_url?: string | null
  parent_page_url?: string | null
  official_url?: string | null
  hasText?: boolean
}): boolean {
  if (!isReadablePdfSource(source)) return false
  return source.hasText !== true
}

/** 台帳に読める本文があるか（URL一致または紐付け） */
export function ruleSourceHasReadableText(input: {
  knowledgeDocumentId?: string | null
  url?: string | null
  documents: Array<{
    id: string
    source_url?: string | null
    hasTextSnapshot: boolean
  }>
}): boolean {
  if (input.knowledgeDocumentId) {
    const byId = input.documents.find((d) => d.id === input.knowledgeDocumentId)
    if (byId?.hasTextSnapshot) return true
  }
  const url = input.url?.trim()
  if (!url) return false
  return input.documents.some(
    (d) => d.hasTextSnapshot && d.source_url?.trim() === url
  )
}
