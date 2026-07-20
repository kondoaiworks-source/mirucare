import type {
  RuleHumanReviewStatus,
  RuleMaterialCategory,
  RuleSourceFileType,
  ServiceType,
} from "@/types/database"

/** 対象市区町村の管轄コード（seed・フィルタ用。逗子市は今回対象外） */
export const TARGET_MUNICIPALITY_CODES = [
  "JP-14-14100", // 横浜市
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
