/**
 * ルール設定 UI の用語の正。
 * 画面文言はこの定義に合わせ、内部用語（rule_sets 等）は出さない。
 *
 * 階層の正:
 * サービス → ルールブック（市）→ カテゴリ → 判定ルール
 * 国・県・市の根拠URLはカテゴリの横（根拠の層）。
 *
 * @see docs/ルールブック構想.md
 */

export const RULES_UI = {
  setup: "利用設定",
  monitoring: "監視状況",
  service: "サービス",
  municipality: "対象自治体",
  rulebook: "ルールブック",
  evidenceUrl: "根拠URL",
  /** ルールブックに載せる「何を見るか」の枠（旧・チェック見出し） */
  category: "カテゴリ",
  /** audit_item.category（契約・加算など）の画面表示。ページ名の「カテゴリ」と区別する */
  categoryKind: "分類",
  standardCategorySet: "標準カテゴリセット",
  judgmentRule: "判定ルール",
  pendingRules: "了承待ちの判定ルール案",
  rulesList: "ルール一覧",
  generateRules: "ルール案を生成",
  approve: "了承",
  pendingPage: "判定ルール",
} as const

/** 利用設定の進め方（表示順＝操作順） */
export const SETUP_STEPS = [
  {
    no: 1,
    title: "サービスを選ぶ",
    description: "提供する介護サービスを選びます。",
  },
  {
    no: 2,
    title: "対象自治体を整える",
    description: "公開する市区町村（ルールブックの箱）を決めます。",
  },
  {
    no: 3,
    title: "根拠URLを登録する",
    description: "国・県・市の参照PDFを登録します。",
  },
  {
    no: 4,
    title: "カテゴリを用意する",
    description: "ルールブックに載せるカテゴリを登録します（初回は標準セット）。",
  },
  {
    no: 5,
    title: "判定ルールを整える",
    description: "案の生成・了承・一覧を行います。",
  },
] as const
