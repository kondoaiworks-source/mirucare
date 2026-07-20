/**
 * 自治体別参照URLマスタの初期データ投入。
 *
 * 前提:
 * - マイグレーション 20260720120000_rule_engine.sql 適用済み
 * - マイグレーション 20260720130000_rule_source_urls.sql 適用済み
 * - .env.local に Supabase URL / SERVICE_ROLE_KEY
 *
 * データソース: supabase/seeds/rule_source_urls.json
 * URL を更新したら JSON を編集して再実行（source_key で UPSERT）
 *
 *   npm run seed:rule-sources
 */
import { readFileSync } from "fs"
import { join } from "path"
import { createClient } from "@supabase/supabase-js"
import type {
  RuleMaterialCategory,
  RuleSourceFileType,
  RuleSourceKind,
  ServiceType,
} from "../src/types/database"

type SeedRow = {
  source_key: string
  jurisdiction_code: string
  title: string
  service_type: ServiceType
  material_category: RuleMaterialCategory
  source_kind: RuleSourceKind
  parent_page_url: string | null
  direct_file_url: string | null
  priority: number
  file_type: RuleSourceFileType | null
  source_last_updated_on?: string | null
  content_hash?: string | null
  memo?: string | null
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function primaryUrl(row: SeedRow): string | null {
  return row.direct_file_url?.trim() || row.parent_page_url?.trim() || null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  assert(url && key, "Supabase env missing（.env.local を確認）")

  const seedPath = join(process.cwd(), "supabase/seeds/rule_source_urls.json")
  const rows = JSON.parse(readFileSync(seedPath, "utf-8")) as SeedRow[]
  assert(Array.isArray(rows) && rows.length > 0, "seed データが空です")

  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: jurisdictions, error: jErr } = await service
    .from("rule_jurisdictions")
    .select("id, code")
  assert(!jErr, jErr?.message ?? "管轄マスタ取得失敗")

  const byCode = new Map(
    (jurisdictions ?? []).map((j) => [j.code as string, j.id as string])
  )

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const row of rows) {
    const jurisdictionId = byCode.get(row.jurisdiction_code)
    if (!jurisdictionId) {
      console.warn(`skip: 管轄コード不明 ${row.jurisdiction_code} (${row.source_key})`)
      skipped++
      continue
    }

    const payload = {
      source_key: row.source_key,
      jurisdiction_id: jurisdictionId,
      title: row.title,
      service_type: row.service_type,
      material_category: row.material_category,
      source_kind: row.source_kind,
      parent_page_url: row.parent_page_url?.trim() || null,
      direct_file_url: row.direct_file_url?.trim() || null,
      official_url: primaryUrl(row),
      priority: row.priority,
      file_type: row.file_type,
      source_last_updated_on: row.source_last_updated_on ?? null,
      content_hash: row.content_hash ?? null,
      memo: row.memo ?? null,
      status: "active" as const,
      human_review_status: "unverified" as const,
    }

    const { data: existing } = await service
      .from("rule_sources")
      .select("id")
      .eq("source_key", row.source_key)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await service
        .from("rule_sources")
        .update(payload)
        .eq("id", existing.id)
      if (error?.message?.includes("content_hash")) {
        throw new Error(
          "マイグレーション supabase/migrations/20260720130000_rule_source_urls.sql を先に適用してください。"
        )
      }
      assert(!error, `${row.source_key}: ${error?.message}`)
      updated++
    } else {
      const { error } = await service.from("rule_sources").insert(payload)
      if (error?.message?.includes("content_hash")) {
        throw new Error(
          "マイグレーション supabase/migrations/20260720130000_rule_source_urls.sql を先に適用してください。"
        )
      }
      assert(!error, `${row.source_key}: ${error?.message}`)
      inserted++
    }
  }

  console.log(
    `seed:rule-sources 完了 — 新規 ${inserted} 件 / 更新 ${updated} 件 / スキップ ${skipped} 件`
  )

  // 逗子市など seed から外した source_key は無効化（再実行時の整理）
  const activeKeys = new Set(rows.map((r) => r.source_key))
  const { data: stale } = await service
    .from("rule_sources")
    .select("id, source_key")
    .not("source_key", "is", null)
    .like("source_key", "JP-14-14208:%")

  for (const row of stale ?? []) {
    if (row.source_key && !activeKeys.has(row.source_key)) {
      await service
        .from("rule_sources")
        .update({
          status: "archived",
          memo: "今回対象外（逗子市）。seed から除外済み。",
        })
        .eq("id", row.id)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
