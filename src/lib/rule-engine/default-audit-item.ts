/**
 * 判定ルールの親（audit_items）は内部フック。
 * 運営がカテゴリを事前登録しなくても、ルール案の保存ができるよう自動確保する。
 */

export const DEFAULT_AUDIT_ITEM_CODE = "RULEBOOK"
export const DEFAULT_AUDIT_ITEM_TITLE = "判定ルール"

export type DefaultAuditItemRef = {
  id: string
  code: string
  title: string
}

function asErrorMessage(error: unknown): string | null {
  if (!error) return null
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message)
  }
  return "内部データの準備に失敗しました。"
}

/**
 * 指定ルールセットに内部用の親項目がなければ1件作る。
 */
export async function ensureDefaultAuditItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  ruleSetId: string
): Promise<{ ok: true; data: DefaultAuditItemRef } | { ok: false; error: string }> {
  const existing = await service
    .from("audit_items")
    .select("id, code, title")
    .eq("rule_set_id", ruleSetId)
    .eq("code", DEFAULT_AUDIT_ITEM_CODE)
    .maybeSingle()

  if (existing.error) {
    return { ok: false, error: asErrorMessage(existing.error) ?? "取得に失敗しました。" }
  }
  if (existing.data) {
    const row = existing.data as DefaultAuditItemRef
    return { ok: true, data: { id: row.id, code: row.code, title: row.title } }
  }

  const anyItem = await service
    .from("audit_items")
    .select("id, code, title")
    .eq("rule_set_id", ruleSetId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  if (anyItem.error) {
    return { ok: false, error: asErrorMessage(anyItem.error) ?? "取得に失敗しました。" }
  }
  if (anyItem.data) {
    const row = anyItem.data as DefaultAuditItemRef
    return { ok: true, data: { id: row.id, code: row.code, title: row.title } }
  }

  const inserted = await service
    .from("audit_items")
    .insert({
      rule_set_id: ruleSetId,
      code: DEFAULT_AUDIT_ITEM_CODE,
      title: DEFAULT_AUDIT_ITEM_TITLE,
      description: "",
      category: "その他",
      risk_level: "mid",
      sort_order: 0,
      status: "active",
    })
    .select("id, code, title")
    .single()

  if (inserted.error || !inserted.data) {
    return {
      ok: false,
      error: asErrorMessage(inserted.error) ?? "判定ルールの土台を作れませんでした。",
    }
  }
  const row = inserted.data as DefaultAuditItemRef
  return { ok: true, data: { id: row.id, code: row.code, title: row.title } }
}

/**
 * ルール案生成用。既存の親項目を使い、無ければ各ルールセットへ内部用を1件ずつ用意する。
 */
export async function ensureAuditItemOptions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any
): Promise<
  | { ok: true; data: DefaultAuditItemRef[] }
  | { ok: false; error: string }
> {
  const existing = await service
    .from("audit_items")
    .select("id, code, title")
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .limit(80)

  if (existing.error) {
    return { ok: false, error: asErrorMessage(existing.error) ?? "取得に失敗しました。" }
  }

  const items = (existing.data ?? []) as DefaultAuditItemRef[]
  if (items.length > 0) {
    return { ok: true, data: items }
  }

  const sets = await service.from("rule_sets").select("id").limit(50)
  if (sets.error) {
    return { ok: false, error: asErrorMessage(sets.error) ?? "取得に失敗しました。" }
  }
  const ruleSets = (sets.data ?? []) as Array<{ id: string }>
  if (ruleSets.length === 0) {
    return {
      ok: false,
      error: "対象の自治体がありません。自治体設定で市を整えてからお試しください。",
    }
  }

  const created: DefaultAuditItemRef[] = []
  for (const set of ruleSets) {
    const ensured = await ensureDefaultAuditItem(service, set.id)
    if (!ensured.ok) return { ok: false, error: ensured.error }
    created.push(ensured.data)
  }
  return { ok: true, data: created }
}
