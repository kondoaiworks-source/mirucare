/**
 * ルール設定 UI の用語の正。
 * 画面文言はこの定義に合わせ、内部用語（rule_sets 等）は出さない。
 *
 * 階層の正:
 * 利用設定 → サービス設定／領域マスタ
 * サービス → ルールブックを作る／国・県設定／自治体設定
 * 本線: サービス×領域×自治体 → 下書き → 人が直して確定
 * チェック: 国・県で承認した共通ルール ＋ その市で承認したルール
 *
 * 動線ルール:
 * - 1画面1作業。横飛びリンクは置かない
 * - 次の作業へは親へ戻ってから進む（パンくずに頼る）
 * - 説明文は必要最小限
 *
 * @see docs/ルールブック構想.md
 */

export const RULES_UI = {
  setup: "利用設定",
  monitoring: "監視状況",
  serviceSettings: "サービス設定",
  service: "サービス",
  nationalPrefectureSettings: "国・県設定",
  municipalitySettings: "自治体設定",
  registeredMunicipalities: "登録自治体",
  municipalityMaster: "自治体マスタ",
  evidenceUrlSettings: "根拠URL設定",
  judgmentRuleManage: "判定ルール管理",
  pendingApproval: "承認待ち",
  registeredRules: "登録ルール一覧",
  rulebook: "ルールブック",
  domainMaster: "領域マスタ",
  domain: "領域",
  composeRulebook: "ルールブックを作る",
  composeDraft: "ルールブック下書き",
  confirmRulebook: "確定する",
  evidenceUrl: "根拠URL",
  judgmentRule: "判定ルール",
  generateRules: "ルール生成",
  generateAiBulk: "まとめてAIで生成",
  generateAi: "AIで生成",
  generateManual: "手動で生成",
  openSource: "原文を開く",
  approve: "承認する",
  publish: "運用する",
  unpublish: "停止する",
  /** @deprecated 互換用。画面では judgmentRuleManage を使う */
  pendingPage: "判定ルール管理",
  pendingRules: "承認待ち",
  rulesList: "登録ルール一覧",
  municipality: "自治体設定",
} as const
