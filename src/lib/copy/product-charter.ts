/**
 * プロダクト憲章（docs/プロダクト完成図.md）に沿った共通文言。
 * 断定・保証表現はここに置かないこと。
 */

export const PRODUCT_CHARTER = {
  positionShort:
    "合否・返還は保証しません。実務上の致命傷を未然に浮かび上がらせる予防装置です。",
  positionTitle: "Wチェック支援（予防装置）",
  facilityJudgment:
    "最終判断・提出は貴施設の責任で行ってください。",
  footer:
    "本サービスはWチェック支援であり、最終判断・提出は貴施設の責任で行ってください",
  unverifiedScope:
    "未投入・未照合のデータは未検証です。出ていない指摘＝問題なし、ではありません。",
  monthlyHubLead:
    "月末・請求前に、主要4種の投入状況と矛盾候補をまとめて確認できます。",
  monthlyHubCta: "月末の確認をはじめる",
} as const

/** 月末ハブで扱う4大書類の定義（完成図①） */
export const MONTHLY_CORE_DOCS = [
  {
    id: "care_plan",
    title: "ケアプラン／介護計画書",
    shortTitle: "ケアプラン",
    hint: "居宅サービス計画・訪問介護計画など（日次の書類チェック）",
  },
  {
    id: "service_records",
    title: "サービス提供記録（日報）",
    shortTitle: "日報",
    hint: "介護ソフトの日報CSVを月次取込へ",
  },
  {
    id: "attendance",
    title: "タイムカード（勤怠）",
    shortTitle: "勤怠",
    hint: "出勤・退勤のタイムカードCSVを月次取込へ",
  },
  {
    id: "billing",
    title: "国保連送信前CSV（請求）",
    shortTitle: "請求CSV",
    hint: "サーバーには保存せず、照合画面で端末内処理します",
  },
] as const

export type MonthlyCoreDocId = (typeof MONTHLY_CORE_DOCS)[number]["id"]
