import { createServiceClient } from "@/lib/supabase/server"

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
