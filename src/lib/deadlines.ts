/**
 * 期限アラート用の文言・表示ヘルパー
 */

export const DEADLINE_UI = {
  todayTitle: "今日やること",
  todayEmpty: "今日の期限対応はありません",
  daysLeft: (n: number) => (n === 0 ? "本日" : `残り${n}日`),
  daysOverdue: (n: number) => `${n}日超過`,
  weeklyTitle: "今週のチェック状況",
  weeklyUploads: "アップ数",
  weeklyFindings: "指摘数",
  weeklyFixed: "対応済み数",
  recentFindings: "最近の指摘",
  recentEmpty: "最近の指摘はまだありません",
  ctaCheck: "今日の分をチェックする",
  alertsTitle: "期限アラート",
  alertsDescription:
    "同意・交付・更新・モニタリングなど、確認が必要な期限を一覧できます。",
  tabOverdue: "超過",
  tab7: "7日以内",
  tab30: "30日以内",
  tabDone: "完了",
  markDone: "対応した",
  markDoneDone: "対応済みにしました",
  addManual: "期限を追加する",
  addManualSubmit: "追加する",
  subjectLabel: "対象（例：山田様 ケアプラン）",
  kindLabel: "種類",
  dueDateLabel: "期限日",
  emptyTab: "この区分の期限はありません",
  statusOverdue: "超過",
  statusWarning: "まもなく",
  statusOk: "予定",
  statusDone: "対応済み",
} as const

export const DEADLINE_KIND_OPTIONS = [
  "同意日",
  "交付日",
  "更新期限",
  "モニタリング",
] as const

/**
 * 表示用に個人名を姓＋様までに抑える。
 * 例: 「山田太郎様 ケアプラン」→「山田様 ケアプラン」
 *     「山田様」→「山田様」
 */
export function toPrivacySubject(subject: string): string {
  const trimmed = subject.trim()
  if (!trimmed) return "ご利用者様"

  // 「〇〇様」が既にあれば、様の直前を姓相当（最大4文字）に短縮
  const samaMatch = trimmed.match(/^(.{1,8}?)様(.*)$/)
  if (samaMatch) {
    const namePart = samaMatch[1] ?? ""
    const rest = (samaMatch[2] ?? "").trim()
    // 3文字以上なら姓相当（先頭2文字）に短縮。2文字以下はそのまま
    const surname = namePart.length >= 3 ? namePart.slice(0, 2) : namePart
    const label = `${surname}様`
    return rest ? `${label} ${rest}`.trim() : label
  }

  // 「様」が無い場合も先頭を姓扱いに
  const parts = trimmed.split(/\s+/)
  const first = parts[0] ?? trimmed
  const surname = first.length >= 3 ? first.slice(0, 2) : first
  const rest = parts.slice(1).join(" ")
  return rest ? `${surname}様 ${rest}` : `${surname}様`
}

/** メール本文用（さらに短く） */
export function toEmailSubjectLabel(subject: string): string {
  const privacy = toPrivacySubject(subject)
  const m = privacy.match(/^(.+?様)/)
  return m?.[1] ?? "ご利用者様"
}
