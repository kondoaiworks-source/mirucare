import type { Deadline, DeadlineKind, DeadlineStatus } from "@/types/database"

/** ローカル日付 YYYY-MM-DD */
export function toDateOnly(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y!, m! - 1, d!)
}

/** due_date までの残日数（負なら超過日数の絶対値用に負） */
export function daysUntilDue(dueDate: string, today = toDateOnly()): number {
  const due = parseDateOnly(dueDate).getTime()
  const now = parseDateOnly(today).getTime()
  return Math.round((due - now) / (1000 * 60 * 60 * 24))
}

/**
 * 保存用ステータスを再計算（done は維持）
 */
export function computeDeadlineStatus(
  dueDate: string,
  current: DeadlineStatus,
  today = toDateOnly()
): DeadlineStatus {
  if (current === "done") return "done"
  const days = daysUntilDue(dueDate, today)
  if (days < 0) return "overdue"
  if (days <= 7) return "warning"
  return "ok"
}

export function refreshDeadlineStatuses<T extends Pick<Deadline, "due_date" | "status">>(
  items: T[],
  today = toDateOnly()
): T[] {
  return items.map((item) => ({
    ...item,
    status: computeDeadlineStatus(item.due_date, item.status, today),
  }))
}

export type DeadlineTab = "overdue" | "within7" | "within30" | "done"

export function filterByTab(
  items: Deadline[],
  tab: DeadlineTab,
  today = toDateOnly()
): Deadline[] {
  const refreshed = refreshDeadlineStatuses(items, today)
  return refreshed
    .filter((d) => {
      if (tab === "done") return d.status === "done"
      if (d.status === "done") return false
      const days = daysUntilDue(d.due_date, today)
      if (tab === "overdue") return days < 0
      if (tab === "within7") return days >= 0 && days <= 7
      if (tab === "within30") return days >= 0 && days <= 30
      return false
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
}

/** findings テキストから期限種別を推定 */
export function inferDeadlineKind(text: string): DeadlineKind | null {
  if (/モニタリング|モニタ/.test(text)) return "モニタリング"
  if (/更新/.test(text)) return "更新期限"
  if (/交付/.test(text)) return "交付日"
  if (/同意|署名/.test(text)) return "同意日"
  return null
}

/** テキストから日付らしきものを拾う（YYYY-MM-DD / YYYY年M月D日） */
export function extractDueDateFromText(
  text: string,
  fallbackDays = 14
): string {
  const iso = text.match(/20\d{2}-\d{2}-\d{2}/)
  if (iso?.[0]) return iso[0]

  const jp = text.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/)
  if (jp) {
    const y = jp[1]
    const m = String(jp[2]).padStart(2, "0")
    const d = String(jp[3]).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  const base = new Date()
  base.setDate(base.getDate() + fallbackDays)
  return toDateOnly(base)
}

export function buildSubjectFromFinding(title: string, docType: string): string {
  const short = title.replace(/\s+/g, " ").slice(0, 40)
  if (short.includes("様")) return short
  return `${short}（${docType}）`
}
