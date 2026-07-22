import type { FindingSeverity, PlanType } from "@/types/database"

/** 画面フッターと同文。PDFにも必ず入れる */
export const REPORT_DISCLAIMER =
  "本サービスはWチェック支援であり、最終判断・提出は貴施設の責任で行ってください"

export const REPORT_UI = {
  title: "月次レポート",
  description:
    "1か月のチェック結果を振り返り、原因分析と改善のヒントを確認できます。",
  monthLabel: "対象月",
  riskLabel: "優先して確認したい指摘候補",
  riskHint: "返還につながりやすい矛盾・疑義の候補件数です（断定ではありません）",
  fixedLabel: "対応済み",
  fixedHint: "「対応した」とした指摘の件数です",
  analysisTitle: "原因分析",
  analysisHint:
    "管理者が手入力で作成した、月次の振り返りレポートです（AI自動生成ではありません）",
  breakdownTitle: "指摘の内訳",
  breakdownHint: "種類（リスクの高さ）別の件数です。多い順に表示しています",
  emptyTitle: "まだレポートがありません",
  emptyDescription:
    "原因分析は管理者が「設定 → レポート管理」で作成します。作成後、こちらに表示されます。",
  upgradeTitle: "プレミアムプランで月次レポートを確認できます",
  upgradeDescription:
    "原因分析と内訳グラフは、施設内会議や法人本部への報告に使えます。ライト／スタンダードではプレビューのみご覧いただけます。",
  upgradeCta: "プランを確認する",
  pdfDownload: "PDFをダウンロード",
  pdfHint: "印刷ダイアログで「PDFに保存」を選ぶと、A4縦の資料になります",
  adminTitle: "月次レポート管理",
  adminDescription:
    "原因分析はAI自動生成ではなく、管理者がMarkdownで手入力して保存します。",
  adminHowTo:
    "対象月を選び、原因分析を書いて「レポートを保存する」と、プレミアムの月次レポート画面に表示されます。",
  save: "レポートを保存する",
  saved: "レポートを保存しました",
} as const

export type SeverityBreakdownItem = {
  key: FindingSeverity
  label: string
  count: number
}

export const SEVERITY_BREAKDOWN_LABELS: Record<FindingSeverity, string> = {
  high: "高（優先確認）",
  mid: "中（確認推奨）",
  low: "低（参考）",
}

/** YYYY-MM → その月の1日（DATE文字列） */
export function monthKeyToDate(monthKey: string): string {
  return `${monthKey}-01`
}

/** DATE / ISO → YYYY-MM */
export function dateToMonthKey(date: string): string {
  return date.slice(0, 7)
}

export function formatMonthJa(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number)
  if (!y || !m) return monthKey
  return `${y}年${m}月`
}

/** 直近 n か月の YYYY-MM（新しい順） */
export function recentMonthKeys(count = 12, from = new Date()): string[] {
  const keys: string[] = []
  const d = new Date(from.getFullYear(), from.getMonth(), 1)
  for (let i = 0; i < count; i++) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    keys.push(`${y}-${m}`)
    d.setMonth(d.getMonth() - 1)
  }
  return keys
}

export function isPremiumPlan(plan: PlanType | null | undefined): boolean {
  return plan === "premium"
}

/** 非プレミアム向けのぼかしプレビュー用サンプル */
export const SAMPLE_REPORT_MD = `## 今月の傾向

署名・同意欄の未記入が目立つ月でした。特にケアプラン関連で、交付日と同意日の前後関係をご確認ください。

> 実地指導では「日付の整合性」がよく見られます。記録のタイミングをチームで揃えると安心です。

### よく見られた指摘

| 種類 | 件数の目安 | 確認のポイント |
|------|------------|----------------|
| 同意・署名 | 多め | 本人・家族の署名欄 |
| 日付の整合 | 中程度 | 作成日と交付日 |
| 加算要件 | 少なめ | 算定根拠の記載 |

### 来月に向けて

1. チェック後は「対応した」をその場で押す習慣をつける
2. 期限アラートを週1回、朝礼で共有する
`

export const SAMPLE_BREAKDOWN: SeverityBreakdownItem[] = [
  { key: "high", label: SEVERITY_BREAKDOWN_LABELS.high, count: 8 },
  { key: "mid", label: SEVERITY_BREAKDOWN_LABELS.mid, count: 5 },
  { key: "low", label: SEVERITY_BREAKDOWN_LABELS.low, count: 2 },
]
