import type { AuditItemCategory, FindingSeverity } from "@/types/database"

export type HomeVisitAuditTemplateItem = {
  code: string
  title: string
  section: string
  category: AuditItemCategory
  riskLevel: FindingSeverity
  description: string
}

function templateItem(
  section: string,
  title: string,
  code: string,
  category: AuditItemCategory
): HomeVisitAuditTemplateItem {
  return {
    code,
    title,
    section,
    category,
    riskLevel: "mid",
    description: `訪問介護監査項目（最大公約数）の「${section}」内にある「${title}」の観点です。関連書類・記録をご確認ください。`,
  }
}

export const HOME_VISIT_AUDIT_TEMPLATE_ITEMS = [
  templateItem("指定・運営体制", "指定更新", "HC_GOV_DESIGNATION_RENEWAL", "その他"),
  templateItem("指定・運営体制", "変更届", "HC_GOV_CHANGE_NOTICE", "その他"),
  templateItem("指定・運営体制", "管理者配置", "HC_GOV_MANAGER_PLACEMENT", "人員"),
  templateItem(
    "指定・運営体制",
    "サービス提供責任者配置",
    "HC_GOV_SERVICE_RESPONSIBLE_PERSON",
    "人員"
  ),
  templateItem("指定・運営体制", "人員基準", "HC_GOV_STAFFING_STANDARDS", "人員"),
  templateItem("指定・運営体制", "勤務形態一覧", "HC_GOV_WORK_PATTERN_LIST", "人員"),
  templateItem("指定・運営体制", "雇用契約", "HC_GOV_EMPLOYMENT_CONTRACT", "人員"),
  templateItem("指定・運営体制", "資格証", "HC_GOV_QUALIFICATION_CERT", "人員"),
  templateItem("指定・運営体制", "研修記録", "HC_GOV_TRAINING_RECORD", "人員"),

  templateItem("利用者契約", "契約書", "HC_CONTRACT_SERVICE_CONTRACT", "契約"),
  templateItem("利用者契約", "重要事項説明書", "HC_CONTRACT_IMPORTANT_MATTERS", "契約"),
  templateItem("利用者契約", "個人情報同意書", "HC_CONTRACT_PERSONAL_INFO_CONSENT", "契約"),
  templateItem("利用者契約", "苦情窓口説明", "HC_CONTRACT_COMPLAINT_DESK", "契約"),
  templateItem("利用者契約", "料金説明", "HC_CONTRACT_FEE_EXPLANATION", "契約"),
  templateItem(
    "利用者契約",
    "重要事項最新版",
    "HC_CONTRACT_IMPORTANT_MATTERS_LATEST",
    "契約"
  ),

  templateItem("アセスメント", "初回アセスメント", "HC_ASSESS_INITIAL", "計画"),
  templateItem("アセスメント", "課題分析", "HC_ASSESS_ISSUE_ANALYSIS", "計画"),
  templateItem("アセスメント", "ニーズ把握", "HC_ASSESS_NEEDS", "計画"),
  templateItem("アセスメント", "家族状況", "HC_ASSESS_FAMILY_STATUS", "計画"),
  templateItem("アセスメント", "ADL", "HC_ASSESS_ADL", "計画"),
  templateItem("アセスメント", "IADL", "HC_ASSESS_IADL", "計画"),

  templateItem("訪問介護計画", "ケアプランとの整合", "HC_PLAN_CARE_PLAN_ALIGNMENT", "計画"),
  templateItem("訪問介護計画", "目標設定", "HC_PLAN_GOAL_SETTING", "計画"),
  templateItem("訪問介護計画", "サービス内容", "HC_PLAN_SERVICE_CONTENT", "計画"),
  templateItem("訪問介護計画", "担当者", "HC_PLAN_ASSIGNEE", "計画"),
  templateItem("訪問介護計画", "利用者同意", "HC_PLAN_USER_CONSENT", "計画"),
  templateItem("訪問介護計画", "更新日", "HC_PLAN_UPDATED_DATE", "計画"),

  templateItem("サービス提供記録", "実施日時", "HC_RECORD_SERVICE_DATETIME", "記録"),
  templateItem("サービス提供記録", "実施内容", "HC_RECORD_SERVICE_CONTENT", "記録"),
  templateItem("サービス提供記録", "身体介護内容", "HC_RECORD_PHYSICAL_CARE", "記録"),
  templateItem("サービス提供記録", "生活援助内容", "HC_RECORD_LIFE_SUPPORT", "記録"),
  templateItem("サービス提供記録", "バイタル", "HC_RECORD_VITAL_SIGNS", "記録"),
  templateItem("サービス提供記録", "特記事項", "HC_RECORD_SPECIAL_NOTES", "記録"),
  templateItem("サービス提供記録", "職員署名", "HC_RECORD_STAFF_SIGNATURE", "記録"),
  templateItem("サービス提供記録", "利用者確認", "HC_RECORD_USER_CONFIRMATION", "記録"),

  templateItem("モニタリング", "定期実施", "HC_MONITORING_REGULAR", "計画"),
  templateItem("モニタリング", "評価", "HC_MONITORING_EVALUATION", "計画"),
  templateItem("モニタリング", "計画変更", "HC_MONITORING_PLAN_CHANGE", "計画"),
  templateItem("モニタリング", "家族報告", "HC_MONITORING_FAMILY_REPORT", "計画"),

  templateItem("加算要件", "初回加算", "HC_ADD_INITIAL", "加算"),
  templateItem("加算要件", "緊急時加算", "HC_ADD_EMERGENCY", "加算"),
  templateItem("加算要件", "特定事業所加算", "HC_ADD_SPECIFIC_OFFICE", "加算"),
  templateItem("加算要件", "処遇改善加算", "HC_ADD_TREATMENT_IMPROVEMENT", "加算"),
  templateItem("加算要件", "各加算根拠資料", "HC_ADD_EVIDENCE_DOCS", "加算"),

  templateItem("身体拘束・虐待防止", "委員会", "HC_ABUSE_COMMITTEE", "その他"),
  templateItem("身体拘束・虐待防止", "研修", "HC_ABUSE_TRAINING", "その他"),
  templateItem("身体拘束・虐待防止", "指針", "HC_ABUSE_GUIDELINE", "その他"),
  templateItem("身体拘束・虐待防止", "セルフチェック", "HC_ABUSE_SELF_CHECK", "その他"),
  templateItem("身体拘束・虐待防止", "通報体制", "HC_ABUSE_REPORTING_SYSTEM", "その他"),

  templateItem("感染症対策", "感染対策委員会", "HC_INFECTION_COMMITTEE", "その他"),
  templateItem("感染症対策", "研修", "HC_INFECTION_TRAINING", "その他"),
  templateItem("感染症対策", "マニュアル", "HC_INFECTION_MANUAL", "その他"),
  templateItem("感染症対策", "PPE", "HC_INFECTION_PPE", "その他"),
  templateItem("感染症対策", "感染記録", "HC_INFECTION_RECORD", "その他"),

  templateItem("業務継続計画（BCP）", "感染症BCP", "HC_BCP_INFECTION", "その他"),
  templateItem("業務継続計画（BCP）", "災害BCP", "HC_BCP_DISASTER", "その他"),
  templateItem("業務継続計画（BCP）", "訓練", "HC_BCP_DRILL", "その他"),
  templateItem("業務継続計画（BCP）", "見直し", "HC_BCP_REVIEW", "その他"),

  templateItem("ハラスメント対策", "方針", "HC_HARASSMENT_POLICY", "その他"),
  templateItem("ハラスメント対策", "相談窓口", "HC_HARASSMENT_CONSULTATION_DESK", "その他"),
  templateItem("ハラスメント対策", "研修", "HC_HARASSMENT_TRAINING", "その他"),

  templateItem("安全管理", "事故報告", "HC_SAFETY_ACCIDENT_REPORT", "記録"),
  templateItem("安全管理", "ヒヤリハット", "HC_SAFETY_NEAR_MISS", "記録"),
  templateItem("安全管理", "再発防止", "HC_SAFETY_PREVENT_RECURRENCE", "記録"),
  templateItem("安全管理", "緊急連絡体制", "HC_SAFETY_EMERGENCY_CONTACT", "記録"),

  templateItem("苦情対応", "苦情受付簿", "HC_COMPLAINT_RECEPTION_LOG", "記録"),
  templateItem("苦情対応", "対応記録", "HC_COMPLAINT_RESPONSE_RECORD", "記録"),
  templateItem("苦情対応", "改善記録", "HC_COMPLAINT_IMPROVEMENT_RECORD", "記録"),

  templateItem("個人情報保護", "管理規程", "HC_PRIVACY_MANAGEMENT_RULES", "その他"),
  templateItem("個人情報保護", "同意取得", "HC_PRIVACY_CONSENT", "その他"),
  templateItem("個人情報保護", "保管方法", "HC_PRIVACY_STORAGE_METHOD", "その他"),
  templateItem("個人情報保護", "廃棄方法", "HC_PRIVACY_DISPOSAL_METHOD", "その他"),

  templateItem("研修", "年間研修計画", "HC_TRAINING_ANNUAL_PLAN", "人員"),
  templateItem("研修", "実施記録", "HC_TRAINING_IMPLEMENTATION_RECORD", "人員"),
  templateItem("研修", "新人研修", "HC_TRAINING_NEW_STAFF", "人員"),
  templateItem("研修", "法定研修", "HC_TRAINING_LEGAL", "人員"),

  templateItem("会議", "サービス担当者会議", "HC_MEETING_SERVICE_STAFF", "記録"),
  templateItem("会議", "カンファレンス", "HC_MEETING_CONFERENCE", "記録"),
  templateItem("会議", "委員会議事録", "HC_MEETING_COMMITTEE_MINUTES", "記録"),

  templateItem("記録保存", "保存期間", "HC_RETENTION_PERIOD", "記録"),
  templateItem("記録保存", "電子保存", "HC_RETENTION_ELECTRONIC", "記録"),
  templateItem("記録保存", "閲覧管理", "HC_RETENTION_ACCESS_CONTROL", "記録"),

  templateItem("報酬請求", "提供記録との一致", "HC_BILLING_SERVICE_RECORD_MATCH", "請求"),
  templateItem("報酬請求", "実績との一致", "HC_BILLING_ACTUAL_RESULT_MATCH", "請求"),
  templateItem("報酬請求", "加算算定根拠", "HC_BILLING_ADDITION_EVIDENCE", "請求"),
  templateItem("報酬請求", "請求漏れ・過誤請求", "HC_BILLING_MISSING_OR_ERROR", "請求"),
] as const satisfies readonly HomeVisitAuditTemplateItem[]
