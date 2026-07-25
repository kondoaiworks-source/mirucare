/**
 * ホーム画面の文言（施設向け・1画面4ブロック）
 */

export const HOME_UI = {
  title: "ホーム",
  summaryLines: [
    "監査のミカタは、介護書類のWチェックを支援するサービスです。",
    "合否や返還は保証しません。致命傷になりやすい不備の可能性を早めに浮かび上がらせます。",
    "運用AI監査から書類をアップし、結果とお知らせ・今日やることをここで確認できます。",
  ] as const,
  ctaOperations: "運用AI監査を始める",
  ctaUpload: "監査書類をアップロードする",

  announcementsTitle: "ルールブック更新お知らせ",
  announcementsHint:
    "国・自治体のルール更新を、運営確認後にお知らせします（個人情報は含みません）。",
  announcementsEmpty: "お知らせはありません",
  announcementsAll: "すべて見る",

  todayTitle: "今日やること",
  todayHint: "未完了の書類チェックと、まもなくの期限を最大3件表示します。",
  todayEmpty: "今日のチェックや期限対応はありません",

  recentTitle: "最近の指摘",
  recentHint: "直近の指摘候補です。優先度を確認し、対応状況をご確認ください。",
  recentEmpty: "最近の指摘はまだありません",
} as const
