import type { DocType, FindingSeverity } from "@/types/database"
import { PHASE1_RULE_CODE_ALLOWLIST } from "@/lib/phase1-audit"

export type Phase1AiRuleSeed = {
  code: string
  title: string
  /** 紐づける監査項目の code（訪問介護テンプレート） */
  auditItemCode: string
  targetDocTypes: DocType[]
  severity: FindingSeverity
  guidanceText: string
}

/**
 * 運営指導で見られやすい頻出観点の AI 判定ルール初期シード。
 * 監査項目テンプレ登録後に、運営画面またはスクリプトから投入する。
 */
export const PHASE1_AI_RULE_SEEDS: Phase1AiRuleSeed[] = [
  {
    code: "HC_PLAN_CARE_PLAN_ALIGNMENT",
    auditItemCode: "HC_PLAN_CARE_PLAN_ALIGNMENT",
    title: "ケアプランと訪問介護計画の整合",
    targetDocTypes: ["ケアプラン"],
    severity: "high",
    guidanceText:
      "ケアプランと訪問介護計画書で、サービス内容・目標・頻度・時間帯に食い違いがないかご確認ください。断定せず「可能性」として指摘してください。",
  },
  {
    code: "HC_PLAN_GOAL_SETTING",
    auditItemCode: "HC_PLAN_GOAL_SETTING",
    title: "計画の目標設定の確認",
    targetDocTypes: ["ケアプラン"],
    severity: "mid",
    guidanceText:
      "訪問介護計画の目標がケアプランの意向・課題とつながっているか、未記載や曖昧な表現がないかご確認ください。",
  },
  {
    code: "HC_PLAN_SERVICE_CONTENT",
    auditItemCode: "HC_PLAN_SERVICE_CONTENT",
    title: "計画のサービス内容の確認",
    targetDocTypes: ["ケアプラン"],
    severity: "high",
    guidanceText:
      "計画に記載の身体介護・生活援助などの内容が、ケアプランのサービス内容と整合しているかご確認ください。",
  },
  {
    code: "HC_PLAN_ASSIGNEE",
    auditItemCode: "HC_PLAN_ASSIGNEE",
    title: "計画の担当者記載の確認",
    targetDocTypes: ["ケアプラン", "勤務表"],
    severity: "mid",
    guidanceText:
      "訪問介護計画の担当者と、シフト／勤務表上の配置に大きなずれがないかご確認ください（氏名は匿名で扱ってください）。",
  },
  {
    code: "HC_PLAN_UPDATED_DATE",
    auditItemCode: "HC_PLAN_UPDATED_DATE",
    title: "計画の更新日の確認",
    targetDocTypes: ["ケアプラン"],
    severity: "mid",
    guidanceText:
      "訪問介護計画の作成・更新日が、ケアプラン変更後に追いついていない可能性がないかご確認ください。",
  },
  {
    code: "HC_RECORD_SERVICE_DATETIME",
    auditItemCode: "HC_RECORD_SERVICE_DATETIME",
    title: "提供記録の実施日時と計画の整合",
    targetDocTypes: ["提供記録"],
    severity: "high",
    guidanceText:
      "サービス提供記録の実施日時が、計画上の予定と大きくずれていないかご確認ください。架空請求疑義につながる可能性があるため優先度を高くしてください。",
  },
  {
    code: "HC_RECORD_SERVICE_CONTENT",
    auditItemCode: "HC_RECORD_SERVICE_CONTENT",
    title: "提供記録の実施内容と計画の整合",
    targetDocTypes: ["提供記録"],
    severity: "high",
    guidanceText:
      "提供記録の実施内容が、訪問介護計画のサービス内容と一致しているかご確認ください。計画にない内容が常態化していないかもご確認ください。",
  },
  {
    code: "HC_RECORD_PHYSICAL_CARE",
    auditItemCode: "HC_RECORD_PHYSICAL_CARE",
    title: "身体介護の記録と計画の整合",
    targetDocTypes: ["提供記録"],
    severity: "mid",
    guidanceText:
      "身体介護の記録が計画どおりか、記録漏れの可能性がないかご確認ください。",
  },
  {
    code: "HC_RECORD_LIFE_SUPPORT",
    auditItemCode: "HC_RECORD_LIFE_SUPPORT",
    title: "生活援助の記録と計画の整合",
    targetDocTypes: ["提供記録"],
    severity: "mid",
    guidanceText:
      "生活援助の記録が計画どおりか、計画外作業に読める記載がないかご確認ください。",
  },
  {
    code: "HC_RECORD_SPECIAL_NOTES",
    auditItemCode: "HC_RECORD_SPECIAL_NOTES",
    title: "提供記録の特記と計画の整合",
    targetDocTypes: ["提供記録"],
    severity: "low",
    guidanceText:
      "特記事項が計画変更やモニタリングに繋がる内容なのに、計画側が未更新に見える場合はご確認ください。",
  },
  {
    code: "HC_GOV_WORK_PATTERN_LIST",
    auditItemCode: "HC_GOV_WORK_PATTERN_LIST",
    title: "勤務形態・シフトと提供記録の整合",
    targetDocTypes: ["勤務表", "提供記録"],
    severity: "high",
    guidanceText:
      "シフト／勤務表の担当・時間と、サービス提供記録の実施が食い違っていないかご確認ください。人員基準違反の疑義につながる可能性があります。",
  },
  {
    code: "HC_GOV_STAFFING_STANDARDS",
    auditItemCode: "HC_GOV_STAFFING_STANDARDS",
    title: "人員配置と提供実態の確認",
    targetDocTypes: ["勤務表"],
    severity: "mid",
    guidanceText:
      "勤務表上の配置が、提供記録の実施体制と大きくずれていないかご確認ください。断定は避けてください。",
  },
  {
    code: "HC_BILLING_SERVICE_RECORD_MATCH",
    auditItemCode: "HC_BILLING_SERVICE_RECORD_MATCH",
    title: "請求と提供記録の一致",
    targetDocTypes: ["請求データ", "提供記録"],
    severity: "high",
    guidanceText:
      "国保連請求（または請求CSV）と提供記録で、日付・サービス内容に食い違いがないかご確認ください。生の請求CSVはサーバに残さない前提です。",
  },
  {
    code: "HC_BILLING_ACTUAL_RESULT_MATCH",
    auditItemCode: "HC_BILLING_ACTUAL_RESULT_MATCH",
    title: "請求と実績の一致",
    targetDocTypes: ["請求データ"],
    severity: "high",
    guidanceText:
      "請求内容と実績（提供記録等）に件数・時間のずれがないかご確認ください。",
  },
  {
    code: "HC_BILLING_MISSING_OR_ERROR",
    auditItemCode: "HC_BILLING_MISSING_OR_ERROR",
    title: "請求漏れ・過誤の可能性",
    targetDocTypes: ["請求データ", "提供記録"],
    severity: "mid",
    guidanceText:
      "提供記録があるのに請求がない、または請求のみで根拠記録が薄い箇所がないかご確認ください。",
  },
  {
    code: "HC_GOV_DESIGNATION_RENEWAL",
    auditItemCode: "HC_GOV_DESIGNATION_RENEWAL",
    title: "指定更新と運営書類の確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "指定通知・更新申請控え・運営規程で、指定有効期限やサービス種別が現在の運営内容とずれている可能性がないかご確認ください。",
  },
  {
    code: "HC_GOV_CHANGE_NOTICE",
    auditItemCode: "HC_GOV_CHANGE_NOTICE",
    title: "変更届が必要な変更の確認",
    targetDocTypes: ["勤務表", "その他"],
    severity: "mid",
    guidanceText:
      "運営規程・勤務表・事業所情報で、管理者や所在地など変更届が必要な内容に未提出の可能性がないかご確認ください。",
  },
  {
    code: "HC_GOV_MANAGER_PLACEMENT",
    auditItemCode: "HC_GOV_MANAGER_PLACEMENT",
    title: "管理者配置の確認",
    targetDocTypes: ["勤務表"],
    severity: "mid",
    guidanceText:
      "勤務表・雇用契約・辞令等で、管理者の配置や兼務状況が運営実態とずれている可能性がないかご確認ください。",
  },
  {
    code: "HC_GOV_SERVICE_RESPONSIBLE_PERSON",
    auditItemCode: "HC_GOV_SERVICE_RESPONSIBLE_PERSON",
    title: "サービス提供責任者の配置確認",
    targetDocTypes: ["勤務表"],
    severity: "high",
    guidanceText:
      "勤務表・資格証・利用者数の資料で、サービス提供責任者の人数や資格が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_GOV_EMPLOYMENT_CONTRACT",
    auditItemCode: "HC_GOV_EMPLOYMENT_CONTRACT",
    title: "雇用契約と勤務実態の確認",
    targetDocTypes: ["勤務表", "その他"],
    severity: "mid",
    guidanceText:
      "雇用契約書・労働条件通知書・勤務表で、契約上の勤務条件と実際の勤務実績に食い違いがないかご確認ください。",
  },
  {
    code: "HC_GOV_QUALIFICATION_CERT",
    auditItemCode: "HC_GOV_QUALIFICATION_CERT",
    title: "資格証と配置の確認",
    targetDocTypes: ["勤務表"],
    severity: "high",
    guidanceText:
      "資格証の写し・勤務表・担当記録で、必要な資格が確認できない職員が配置されている可能性がないかご確認ください。",
  },
  {
    code: "HC_GOV_TRAINING_RECORD",
    auditItemCode: "HC_GOV_TRAINING_RECORD",
    title: "研修記録の実施確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "年間研修計画・実施記録・参加者名簿で、必要な研修の実施漏れや記録不足の可能性がないかご確認ください。",
  },
  {
    code: "HC_CONTRACT_SERVICE_CONTRACT",
    auditItemCode: "HC_CONTRACT_SERVICE_CONTRACT",
    title: "契約書の日付・署名確認",
    targetDocTypes: ["その他"],
    severity: "high",
    guidanceText:
      "利用契約書で、契約日・説明日・利用者または家族の署名欄に未記載の可能性がないかご確認ください。",
  },
  {
    code: "HC_CONTRACT_IMPORTANT_MATTERS",
    auditItemCode: "HC_CONTRACT_IMPORTANT_MATTERS",
    title: "重要事項説明書の交付・説明確認",
    targetDocTypes: ["その他"],
    severity: "high",
    guidanceText:
      "重要事項説明書と契約書で、説明日・交付日・同意欄が欠けている可能性や契約日との前後関係をご確認ください。",
  },
  {
    code: "HC_CONTRACT_PERSONAL_INFO_CONSENT",
    auditItemCode: "HC_CONTRACT_PERSONAL_INFO_CONSENT",
    title: "個人情報同意書の確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "個人情報同意書・契約関係書類で、同意日や署名が欠けている可能性、利用目的の説明記録が薄い可能性をご確認ください。",
  },
  {
    code: "HC_CONTRACT_COMPLAINT_DESK",
    auditItemCode: "HC_CONTRACT_COMPLAINT_DESK",
    title: "苦情窓口説明の確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "重要事項説明書・苦情対応規程で、事業所や行政窓口の連絡先が古いままになっている可能性がないかご確認ください。",
  },
  {
    code: "HC_CONTRACT_FEE_EXPLANATION",
    auditItemCode: "HC_CONTRACT_FEE_EXPLANATION",
    title: "料金説明と同意の確認",
    targetDocTypes: ["その他", "請求データ"],
    severity: "mid",
    guidanceText:
      "重要事項説明書・料金表・請求データで、利用者負担や加算の説明内容と実際の請求に食い違いがないかご確認ください。",
  },
  {
    code: "HC_CONTRACT_IMPORTANT_MATTERS_LATEST",
    auditItemCode: "HC_CONTRACT_IMPORTANT_MATTERS_LATEST",
    title: "重要事項説明書の最新版確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "重要事項説明書・運営規程・料金表で、改定後の内容が古い様式のまま説明されている可能性がないかご確認ください。",
  },
  {
    code: "HC_ASSESS_INITIAL",
    auditItemCode: "HC_ASSESS_INITIAL",
    title: "初回アセスメントの確認",
    targetDocTypes: ["ケアプラン", "その他"],
    severity: "mid",
    guidanceText:
      "初回アセスメント・ケアプラン・訪問介護計画で、サービス開始前の課題把握が記録されていない可能性がないかご確認ください。",
  },
  {
    code: "HC_ASSESS_ISSUE_ANALYSIS",
    auditItemCode: "HC_ASSESS_ISSUE_ANALYSIS",
    title: "課題分析と計画のつながり確認",
    targetDocTypes: ["ケアプラン"],
    severity: "mid",
    guidanceText:
      "アセスメント・ケアプラン・訪問介護計画で、把握した課題と計画目標がつながっていない可能性がないかご確認ください。",
  },
  {
    code: "HC_ASSESS_NEEDS",
    auditItemCode: "HC_ASSESS_NEEDS",
    title: "本人ニーズの記録確認",
    targetDocTypes: ["ケアプラン"],
    severity: "low",
    guidanceText:
      "アセスメント・ケアプラン・訪問介護計画で、本人や家族の意向が計画内容に反映されていない可能性がないかご確認ください。",
  },
  {
    code: "HC_PLAN_USER_CONSENT",
    auditItemCode: "HC_PLAN_USER_CONSENT",
    title: "訪問介護計画の同意確認",
    targetDocTypes: ["ケアプラン"],
    severity: "high",
    guidanceText:
      "訪問介護計画書で、作成日・説明日・同意日・署名欄に未記載や計画変更後の再同意漏れの可能性がないかご確認ください。",
  },
  {
    code: "HC_RECORD_STAFF_SIGNATURE",
    auditItemCode: "HC_RECORD_STAFF_SIGNATURE",
    title: "提供記録の職員確認欄",
    targetDocTypes: ["提供記録"],
    severity: "low",
    guidanceText:
      "サービス提供記録で、担当職員の記載や確認欄が欠けている可能性、勤務表上の担当者とずれている可能性をご確認ください。",
  },
  {
    code: "HC_RECORD_USER_CONFIRMATION",
    auditItemCode: "HC_RECORD_USER_CONFIRMATION",
    title: "提供記録の利用者確認",
    targetDocTypes: ["提供記録"],
    severity: "mid",
    guidanceText:
      "サービス提供記録で、利用者確認欄・サイン・確認方法の記録が欠けている可能性がないかご確認ください。",
  },
  {
    code: "HC_MONITORING_REGULAR",
    auditItemCode: "HC_MONITORING_REGULAR",
    title: "モニタリングの定期実施確認",
    targetDocTypes: ["ケアプラン", "その他"],
    severity: "mid",
    guidanceText:
      "モニタリング記録・訪問介護計画・サービス提供記録で、定期的な評価記録が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_MONITORING_EVALUATION",
    auditItemCode: "HC_MONITORING_EVALUATION",
    title: "モニタリング評価内容の確認",
    targetDocTypes: ["ケアプラン", "提供記録"],
    severity: "mid",
    guidanceText:
      "モニタリング記録で、目標の達成状況やサービス内容の見直しが具体的に記録されていない可能性がないかご確認ください。",
  },
  {
    code: "HC_MONITORING_PLAN_CHANGE",
    auditItemCode: "HC_MONITORING_PLAN_CHANGE",
    title: "モニタリング後の計画変更確認",
    targetDocTypes: ["ケアプラン", "提供記録"],
    severity: "mid",
    guidanceText:
      "モニタリングで課題が出ているのに、訪問介護計画やケアプランの見直し記録が追いついていない可能性がないかご確認ください。",
  },
  {
    code: "HC_ADD_INITIAL",
    auditItemCode: "HC_ADD_INITIAL",
    title: "初回加算の根拠確認",
    targetDocTypes: ["請求データ", "提供記録", "ケアプラン"],
    severity: "mid",
    guidanceText:
      "請求データ・初回訪問記録・計画書で、初回加算の算定根拠となる時期や記録が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_ADD_EMERGENCY",
    auditItemCode: "HC_ADD_EMERGENCY",
    title: "緊急時加算の根拠確認",
    targetDocTypes: ["請求データ", "提供記録"],
    severity: "mid",
    guidanceText:
      "緊急時対応の記録・依頼経緯・請求データで、緊急時加算の根拠記録が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_ADD_SPECIFIC_OFFICE",
    auditItemCode: "HC_ADD_SPECIFIC_OFFICE",
    title: "特定事業所加算の体制確認",
    targetDocTypes: ["請求データ", "勤務表", "その他"],
    severity: "high",
    guidanceText:
      "加算届・勤務表・研修記録・会議記録で、特定事業所加算の体制要件を示す記録が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_ADD_TREATMENT_IMPROVEMENT",
    auditItemCode: "HC_ADD_TREATMENT_IMPROVEMENT",
    title: "処遇改善加算の記録確認",
    targetDocTypes: ["請求データ", "その他"],
    severity: "mid",
    guidanceText:
      "処遇改善計画書・実績報告・職員周知記録で、加算算定の根拠や周知記録が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_ADD_EVIDENCE_DOCS",
    auditItemCode: "HC_ADD_EVIDENCE_DOCS",
    title: "加算算定根拠資料の確認",
    targetDocTypes: ["請求データ", "提供記録", "勤務表", "その他"],
    severity: "high",
    guidanceText:
      "請求データ・提供記録・勤務表・届出書類で、算定している加算に必要な根拠資料が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_ABUSE_COMMITTEE",
    auditItemCode: "HC_ABUSE_COMMITTEE",
    title: "虐待防止委員会の記録確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "虐待防止委員会の議事録・開催記録で、開催実績や参加者、検討内容の記録が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_ABUSE_TRAINING",
    auditItemCode: "HC_ABUSE_TRAINING",
    title: "虐待防止研修の記録確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "虐待防止研修の計画・実施記録・参加者名簿で、実施漏れや記録不足の可能性がないかご確認ください。",
  },
  {
    code: "HC_INFECTION_COMMITTEE",
    auditItemCode: "HC_INFECTION_COMMITTEE",
    title: "感染症対策委員会の確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "感染症対策委員会の開催記録・議事録で、開催頻度や検討内容の記録が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_INFECTION_TRAINING",
    auditItemCode: "HC_INFECTION_TRAINING",
    title: "感染症研修・訓練の確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "感染症研修・訓練記録・参加者名簿で、必要な実施記録や参加状況が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_BCP_INFECTION",
    auditItemCode: "HC_BCP_INFECTION",
    title: "感染症BCPの確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "感染症BCP・研修記録・訓練記録で、計画の整備や職員への周知が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_BCP_DISASTER",
    auditItemCode: "HC_BCP_DISASTER",
    title: "災害BCPの確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "災害BCP・避難訓練記録・連絡体制表で、計画の整備や訓練記録が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_HARASSMENT_POLICY",
    auditItemCode: "HC_HARASSMENT_POLICY",
    title: "ハラスメント防止方針の確認",
    targetDocTypes: ["その他"],
    severity: "low",
    guidanceText:
      "ハラスメント防止方針・相談窓口の案内・職員周知記録で、周知や相談体制の記録が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_SAFETY_ACCIDENT_REPORT",
    auditItemCode: "HC_SAFETY_ACCIDENT_REPORT",
    title: "事故報告と対応記録の確認",
    targetDocTypes: ["提供記録", "その他"],
    severity: "high",
    guidanceText:
      "事故報告書・経過記録・家族や行政への報告記録で、報告日や再発防止策の記録が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_SAFETY_PREVENT_RECURRENCE",
    auditItemCode: "HC_SAFETY_PREVENT_RECURRENCE",
    title: "事故の再発防止策確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "事故報告書・会議録・改善記録で、再発防止策の検討や実施記録が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_COMPLAINT_RESPONSE_RECORD",
    auditItemCode: "HC_COMPLAINT_RESPONSE_RECORD",
    title: "苦情対応記録の確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "苦情受付簿・対応記録・改善記録で、受付日、対応経過、説明内容が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_RETENTION_PERIOD",
    auditItemCode: "HC_RETENTION_PERIOD",
    title: "記録保存期間の確認",
    targetDocTypes: ["その他"],
    severity: "low",
    guidanceText:
      "運営規程・保存管理表・廃棄記録で、保存期間内の記録が確認できない可能性や廃棄記録の不足がないかご確認ください。",
  },
  {
    code: "HC_PRIVACY_CONSENT",
    auditItemCode: "HC_PRIVACY_CONSENT",
    title: "個人情報利用同意の確認",
    targetDocTypes: ["その他"],
    severity: "mid",
    guidanceText:
      "個人情報同意書・契約書・サービス担当者会議資料で、個人情報利用の同意や共有範囲の説明が不足している可能性がないかご確認ください。",
  },
  {
    code: "HC_PRIVACY_STORAGE_METHOD",
    auditItemCode: "HC_PRIVACY_STORAGE_METHOD",
    title: "個人情報の保管方法確認",
    targetDocTypes: ["その他"],
    severity: "low",
    guidanceText:
      "個人情報管理規程・保管場所の記録・アクセス管理表で、保管方法や閲覧管理の記録が不足している可能性がないかご確認ください。",
  },
]

export const FREQUENT_GUIDANCE_RULE_SEEDS = PHASE1_AI_RULE_SEEDS

/** allowlist とシード定義の差分チェック用 */
export function phase1SeedCodes(): string[] {
  return PHASE1_AI_RULE_SEEDS.map((s) => s.code)
}

export function missingAllowlistCodesInSeeds(): string[] {
  const seeded = new Set(phase1SeedCodes())
  return Array.from(new Set(PHASE1_RULE_CODE_ALLOWLIST)).filter(
    (c) => !seeded.has(c)
  )
}
