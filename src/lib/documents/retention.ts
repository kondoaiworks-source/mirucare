import { createServiceClient } from "@/lib/supabase/server"

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

/**
 * Storage 上の原本を削除し、original_purged_at を立てる。
 * file_path は空文字にせずパスを残す（履歴メタ用）。実体のみ消す。
 */
export async function purgeDocumentOriginal(
  documentId: string,
  filePath: string,
  organizationId: string,
  service = createServiceClient()
): Promise<{ ok: boolean; error?: string }> {
  if (!filePath) {
    await service
      .from("documents")
      .update({ original_purged_at: new Date().toISOString() })
      .eq("id", documentId)
      .eq("organization_id", organizationId)
    return { ok: true }
  }

  const { error: storageError } = await service.storage
    .from("documents")
    .remove([filePath])

  if (storageError) {
    console.error("[retention] storage_remove_failed", {
      message: storageError.message.slice(0, 120),
    })
    return { ok: false, error: storageError.message }
  }

  const { error } = await service
    .from("documents")
    .update({ original_purged_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .is("original_purged_at", null)

  if (error) {
    console.error("[retention] mark_purged_failed", {
      message: error.message.slice(0, 120),
    })
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

/** 期限到来の原本を一括削除（Cron用） */
export async function purgeDueDocumentOriginals(limit = 100): Promise<{
  checked: number
  purged: number
  failed: number
}> {
  const service = createServiceClient()
  const nowIso = new Date().toISOString()

  const { data, error } = await service
    .from("documents")
    .select("id, organization_id, file_path")
    .is("original_purged_at", null)
    .is("deleted_at", null)
    .not("original_purge_after", "is", null)
    .lte("original_purge_after", nowIso)
    .neq("file_path", "")
    .limit(limit)

  if (error) {
    console.error("[retention] list_due_failed", {
      message: error.message.slice(0, 120),
    })
    return { checked: 0, purged: 0, failed: 0 }
  }

  const rows = data ?? []
  let purged = 0
  let failed = 0

  for (const row of rows) {
    const result = await purgeDocumentOriginal(
      row.id as string,
      (row.file_path as string) ?? "",
      row.organization_id as string,
      service
    )
    if (result.ok) purged += 1
    else failed += 1
  }

  return { checked: rows.length, purged, failed }
}

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
