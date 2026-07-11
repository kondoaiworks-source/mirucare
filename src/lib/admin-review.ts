import type { FindingSeverity, FindingReviewStatus, DocType } from "@/types/database"

export const ADMIN_REVIEW_UI = {
  title: "レビューコンソール",
  description:
    "AIの一次判定を確認してから公開します。キーボード（J/K移動・A承認・R却下）で高速処理できます。",
  queueTitle: "未承認キュー",
  queueEmpty: "未承認の指摘はありません",
  queueEmptyHint: "新しいチェックが来ると、ここに古い順で並びます。",
  metricsTitle: "レビュー負荷",
  metricsHint: "1人運営で20〜30拠点を回せるかの目安です",
  avgLabel: "1件あたり平均",
  pendingLabel: "未承認",
  reviewedTodayLabel: "本日処理",
  feedbackTitle: "「これは違うと思う」フィードバック",
  feedbackEmpty: "フィードバックはまだありません",
  feedbackNoteLabel: "対応メモ（ナレッジ改善ToDo）",
  feedbackNoteSave: "メモを保存する",
  approve: "そのまま承認",
  approveEdit: "修正して承認",
  reject: "却下する",
  shortcuts: "J 次へ ／ K 前へ ／ A 承認 ／ R 却下 ／ ⌘↵ 修正承認",
  orgLabel: "事業所",
  docTypeLabel: "書類種別",
  municipalityLabel: "自治体",
  severityLabel: "リスク",
  originalTitle: "AIの指摘原文",
  editHint: "文言を直してから承認する場合は、下の欄を編集して「修正して承認」または ⌘↵ です。",
} as const

export type ReviewQueueItem = {
  id: string
  document_id: string
  organization_id: string
  severity: FindingSeverity
  title: string
  description: string
  basis: string | null
  suggestion: string | null
  review_status: FindingReviewStatus
  created_at: string
  organization_name: string
  municipality: string | null
  doc_type: DocType
}

export type ReviewMetrics = {
  pendingCount: number
  reviewedToday: number
  avgDurationMs: number | null
  sampleCount: number
}

export type FeedbackInboxItem = {
  id: string
  finding_id: string
  document_id: string
  organization_id: string
  reason: string | null
  operator_note: string | null
  created_at: string
  organization_name: string
  finding_title: string
  doc_type: DocType
}

export function formatDurationMs(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(1)}秒`
  const min = Math.floor(sec / 60)
  const rem = Math.round(sec % 60)
  return `${min}分${rem}秒`
}

export function severityLabelJa(severity: FindingSeverity): string {
  if (severity === "high") return "高"
  if (severity === "low") return "低"
  return "中"
}
