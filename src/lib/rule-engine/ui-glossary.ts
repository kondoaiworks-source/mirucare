/**
 * ルール設定 UI の用語の正。
 * 画面文言はこの定義に合わせ、内部用語（rule_sets 等）は出さない。
 *
 * 階層の正:
 * 利用設定 → サービス設定／マスタ（領域・自治体）
 * サービス → ルールブックを作る／ルールブックを見る／資料庫
 * 作る: ①領域（チェック）→ ②国・県の資料と下書き → ③市の資料と下書き
 * 見る: 国・県（共通）／各市
 * 本線: 資料庫にPDF直URLを置く → 監視 → 作る → 人が直して確定 → 見る
 * 根拠: 資料庫（国／県／市の公式PDF。領域の下には置かない）
 * チェック: 国・県の共通ルール ＋ その市のルール
 * 欄: ルール名＝見出し、ルール＝見比べ本文（旧「案内文」）
 *
 * 動線ルール:
 * - 1画面1作業。横飛びリンクは置かない
 * - 例外: 了承画面で本文0件→資料庫。監視で差分あり→作る。監視でエラー→資料庫
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
  viewRulebook: "ルールブックを見る",
  sourceList: "資料庫",
  ruleName: "ルール名",
  ruleText: "ルール",
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
