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
 * Phase1（1・3・7・8）向け AI 判定ルール初期シード。
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
]

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
