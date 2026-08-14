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
  "公式PDFの直リンクを置くと、監視状況に載ります。一覧ページだけでは本文も更新検知も弱いことがあります。変わったら人が原文を確認し、ルールブックを作るから作り直してください。自動では本番の物差しを書き換えません。"

/** 直接ファイルURL欄の短い補足 */
export const SOURCE_URL_DIRECT_FILE_HINT =
  "公開情報PDFの直リンクです。更新の自動監視に必要です。公開情報リンク（一覧ページ）だけでは監視が始まらないことがあります。"

/** 本文が無いときの、人によるリンク確認 */
export const SOURCE_URL_FIX_HINT =
  "リンク先を開いて確認してください。規則・様式のPDF直リンクならそのままでよい。お知らせや一覧のHTMLなら、PDFの直URLに直してください。ページ移転や404なら新しい公式ページに更新してください。"

export function looksLikeDirectFileUrl(
  url: string | null | undefined,
  fileType?: string | null
): boolean {
  if (fileType === "pdf") return true
  const lower = url?.trim().toLowerCase() ?? ""
  if (!lower) return false
  return lower.includes(".pdf") || lower.includes("application/pdf")
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
