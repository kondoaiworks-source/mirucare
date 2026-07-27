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

/** 参照URL登録時の自動監視注意（UI・マニュアルで共通） */
export const SOURCE_URL_MONITORING_ALERT_TITLE = "自動監視について"

export const SOURCE_URL_MONITORING_ALERT_BODY =
  "参照URLを登録すると連携監視（台帳）へ自動で紐付きます。ただし一覧ページURLだけの登録だと、台帳には載っても「以降の変更を自動監視」までは行かないことがあります。更新アラートを受け取るには、PDFなどの直リンク（直接ファイルURL）を入れてください。"

/** 直接ファイルURL欄の短い補足 */
export const SOURCE_URL_DIRECT_FILE_HINT =
  "更新の自動監視に必要です。一覧ページだけでは監視が始まらないことがあります。"
