/**
 * Phase1 運用AI監査の対象項目（実装・画面の正）
 * @see docs/PHASE1_REDESIGN.md
 */

export const PHASE1_OPERATION_CHECKS = [
  {
    no: 1,
    title: "ケアプラン ⇔ 訪問介護計画書",
    description: "サービス内容・目標・頻度・時間の一致をご確認ください。",
  },
  {
    no: 3,
    title: "計画 ⇔ 実績（サービス提供記録）",
    description: "計画どおり提供されたかの整合をご確認ください。",
  },
  {
    no: 7,
    title: "シフト ⇔ サービス提供記録",
    description: "担当・時間の一致をご確認ください。",
  },
  {
    no: 8,
    title: "国保連請求 ⇔ 実績",
    description:
      "請求と実績の食い違い候補です。請求CSVはサーバに残さない方針です。",
  },
] as const

/** Phase1 対象市（神奈川） */
export const PHASE1_MUNICIPALITIES = [
  "横浜市",
  "川崎市",
  "藤沢市",
  "鎌倉市",
  "茅ヶ崎市",
] as const

/**
 * 訪問介護テンプレート／AI判定ルールの code のうち、
 * Phase1（項目1・3・7・8）に使うもの。
 */
export const PHASE1_RULE_CODE_ALLOWLIST = [
  // 1: ケアプラン ⇔ 訪問介護計画書
  "HC_PLAN_CARE_PLAN_ALIGNMENT",
  "HC_PLAN_GOAL_SETTING",
  "HC_PLAN_SERVICE_CONTENT",
  "HC_PLAN_ASSIGNEE",
  "HC_PLAN_UPDATED_DATE",
  // 3: 計画 ⇔ 実績
  "HC_RECORD_SERVICE_DATETIME",
  "HC_RECORD_SERVICE_CONTENT",
  "HC_RECORD_PHYSICAL_CARE",
  "HC_RECORD_LIFE_SUPPORT",
  "HC_RECORD_SPECIAL_NOTES",
  // 7: シフト ⇔ 提供記録（勤務・人員系で近似）
  "HC_GOV_WORK_PATTERN_LIST",
  "HC_GOV_STAFFING_STANDARDS",
  "HC_PLAN_ASSIGNEE",
  // 8: 請求 ⇔ 実績
  "HC_BILLING_SERVICE_RECORD_MATCH",
  "HC_BILLING_ACTUAL_RESULT_MATCH",
  "HC_BILLING_MISSING_OR_ERROR",
] as const

const PHASE1_CODE_SET = new Set<string>(PHASE1_RULE_CODE_ALLOWLIST)

/** code が無い／独自ルール向けのタイトル・監査項目キーワード */
const PHASE1_TITLE_KEYWORDS = [
  "ケアプラン",
  "訪問介護計画",
  "計画書",
  "提供記録",
  "サービス提供",
  "実績",
  "シフト",
  "勤務表",
  "勤務形態",
  "請求",
  "国保連",
  "報酬",
  "計画と",
  "整合",
] as const

export function isPhase1RuleCode(code: string | null | undefined): boolean {
  if (!code) return false
  return PHASE1_CODE_SET.has(code.trim())
}

export function matchesPhase1RuleText(
  code: string | null | undefined,
  title: string | null | undefined,
  auditItemTitle: string | null | undefined
): boolean {
  if (isPhase1RuleCode(code)) return true
  const hay = `${title ?? ""}\n${auditItemTitle ?? ""}`
  return PHASE1_TITLE_KEYWORDS.some((kw) => hay.includes(kw))
}

/**
 * 施設向けチェックは既定で、承認済みルールブックの頻出観点を使う。
 * CHECK_RULES_SCOPE=phase1 のときだけ、従来の基本突合（1・3・7・8）に絞る。
 */
export function shouldScopeCheckRulesToPhase1(): boolean {
  const raw = process.env.CHECK_RULES_SCOPE?.trim().toLowerCase()
  return raw === "phase1"
}
