export const ORIGINAL_KEEP_DAYS_OPTIONS = [0, 7] as const
export type OriginalKeepDays = (typeof ORIGINAL_KEEP_DAYS_OPTIONS)[number]

export const RETENTION_COPY = {
  policyShort:
    "原本は監査に使い、完了後は原則すぐ削除します。指摘結果（匿名）だけ残します。",
  keep7Label: "再確認のため、原本を最大7日間残す",
  keep7Hint:
    "オフ（推奨）の場合、監査完了後に原本ファイルを削除します。結果の閲覧は引き続きできます。",
  consentRequired:
    "監査を開始するには、原本の取り扱いへの同意が必要です。",
  purged:
    "原本ファイルは削除済みです。監査結果（匿名）のみ閲覧できます。",
} as const

export function computePurgeAfter(
  keepOriginalDays: OriginalKeepDays,
  from: Date = new Date()
): string {
  if (keepOriginalDays <= 0) {
    return from.toISOString()
  }
  const d = new Date(from.getTime())
  d.setDate(d.getDate() + keepOriginalDays)
  return d.toISOString()
}
