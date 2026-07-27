/**
 * 本番向け：自治体ルール投入データをリセットし、指定メール以外のユーザーを削除する。
 *
 * 残すもの:
 * - auth / profiles の KEEP_EMAIL ユーザー（role=admin, is_operator=true）
 * - そのユーザーの organization（ある場合）
 * - rule_jurisdictions / rule_sets（空の骨格）
 *
 * 消すもの:
 * - rule_sources / audit_items / ai_check_* / knowledge_* / sync alerts 等
 * - KEEP 以外の auth.users（profiles は CASCADE）
 * - KEEP org 以外の organizations と、その配下の施設データ
 *
 * 使い方:
 *   DRY_RUN=1 npx tsx --env-file=.env.local scripts/reset-prod-rules-keep-operator.ts
 *   CONFIRM=YES npx tsx --env-file=.env.local scripts/reset-prod-rules-keep-operator.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const KEEP_EMAIL = (
  process.env.KEEP_EMAIL || "kondo.aiworks@gmail.com"
).toLowerCase()
const DRY_RUN =
  process.env.CONFIRM !== "YES" || process.env.DRY_RUN === "1"

async function countRows(
  service: SupabaseClient,
  table: string
): Promise<number | string> {
  const { count, error } = await service
    .from(table)
    .select("*", { count: "exact", head: true })
  if (error) return `ERR:${error.message}`
  return count ?? 0
}

async function deleteAll(
  service: SupabaseClient,
  table: string,
  label?: string
): Promise<number> {
  const name = label ?? table
  // PostgREST は全件 DELETE にフィルタが必要な場合があるため、id を取って消す
  const { data, error: selErr } = await service.from(table).select("id").limit(5000)
  if (selErr) {
    throw new Error(`${name} select: ${selErr.message}`)
  }
  const ids = (data ?? []).map((r) => r.id as string)
  if (ids.length === 0) {
    console.log(`  skip ${name} (0)`)
    return 0
  }
  if (DRY_RUN) {
    console.log(`  DRY_RUN would delete ${name}: ${ids.length}`)
    return ids.length
  }
  const { error } = await service.from(table).delete().in("id", ids)
  if (error) throw new Error(`${name} delete: ${error.message}`)
  console.log(`  deleted ${name}: ${ids.length}`)
  return ids.length
}

async function main() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!url || !key) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です")
    process.exit(1)
  }

  const host = new URL(url).host
  console.log("=== reset-prod-rules-keep-operator ===")
  console.log("host:", host)
  console.log("KEEP_EMAIL:", KEEP_EMAIL)
  console.log("mode:", DRY_RUN ? "DRY_RUN（変更なし）" : "EXECUTE")

  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ---- ユーザー一覧 ----
  const { data: listed, error: listErr } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listErr) throw new Error(listErr.message)
  const users = listed.users
  const keep = users.find(
    (u) => (u.email || "").toLowerCase() === KEEP_EMAIL
  )
  if (!keep) {
    console.error(`KEEP ユーザーが見つかりません: ${KEEP_EMAIL}`)
    process.exit(1)
  }
  console.log("KEEP user:", keep.id, keep.email)

  const { data: keepProfile, error: profErr } = await service
    .from("profiles")
    .select("id, organization_id, role, is_operator, display_name, deleted_at")
    .eq("id", keep.id)
    .maybeSingle()
  if (profErr) throw new Error(profErr.message)
  console.log("KEEP profile:", keepProfile)

  const keepOrgId = (keepProfile?.organization_id as string | null) ?? null
  const others = users.filter((u) => u.id !== keep.id)
  console.log("other users to remove:", others.length)
  for (const u of others) {
    console.log("  -", u.id, u.email)
  }

  const tables = [
    "rule_jurisdictions",
    "rule_sources",
    "rule_sets",
    "audit_items",
    "ai_check_rules",
    "ai_check_rule_versions",
    "knowledge_documents",
    "knowledge_document_snapshots",
    "knowledge_document_change_drafts",
    "knowledge_document_versions",
    "knowledge_sync_alerts",
    "knowledge_watch_items",
    "app_announcements",
    "organizations",
    "profiles",
    "documents",
    "findings",
  ] as const

  console.log("\n--- counts before ---")
  for (const t of tables) {
    console.log(`  ${t}:`, await countRows(service, t))
  }

  // ---- 1) 自治体・ルール投入データ ----
  console.log("\n--- reset municipality / rule content ---")
  // versions → rules → audit_items
  await deleteAll(service, "ai_check_rule_versions")
  await deleteAll(service, "ai_check_rules")
  await deleteAll(service, "audit_items")
  await deleteAll(service, "rule_sources")

  // knowledge 周辺（依存の浅い順）
  await deleteAll(service, "knowledge_sync_alerts")
  await deleteAll(service, "knowledge_watch_items")
  // drafts / versions / snapshots は documents CASCADE でもよいが明示削除
  await deleteAll(service, "knowledge_document_versions")
  await deleteAll(service, "knowledge_document_change_drafts")
  await deleteAll(service, "knowledge_document_snapshots")
  await deleteAll(service, "knowledge_documents")
  await deleteAll(service, "app_announcements")

  // rule_sets / jurisdictions は残す

  // ---- 2) KEEP org 以外の施設データとユーザー ----
  console.log("\n--- remove other users / orgs ---")

  const { data: allOrgs, error: orgErr } = await service
    .from("organizations")
    .select("id, name")
  if (orgErr) throw new Error(orgErr.message)
  const orgsToDelete = (allOrgs ?? []).filter((o) => o.id !== keepOrgId)
  console.log(
    "orgs to delete:",
    orgsToDelete.map((o) => `${o.name}(${o.id})`).join(", ") || "(none)"
  )

  // 他事業所の業務データ（テーブルが無くても続行）
  const facilityTables = [
    "finding_feedback",
    "finding_action_logs",
    "finding_review_logs",
    "findings",
    "documents",
    "deadlines",
    "reports",
    "helpers",
    "shifts",
    "attendance",
    "service_records",
    "invitations",
  ]

  for (const table of facilityTables) {
    if (orgsToDelete.length === 0 && keepOrgId) {
      // KEEP org だけの場合、施設データは触らない（ユーザー要望は自治体リセット中心）
      continue
    }
    for (const org of orgsToDelete) {
      if (DRY_RUN) {
        const { count } = await service
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id)
        if ((count ?? 0) > 0) {
          console.log(
            `  DRY_RUN would delete ${table} for org ${org.id}: ${count}`
          )
        }
        continue
      }
      const { error, count } = await service
        .from(table)
        .delete({ count: "exact" })
        .eq("organization_id", org.id)
      if (error) {
        // テーブル未存在などはスキップ
        if (
          error.message.includes("does not exist") ||
          error.code === "42P01" ||
          error.message.includes("Could not find")
        ) {
          continue
        }
        // organization_id が無いテーブルは invitations 以外スキップ
        if (error.message.includes("organization_id")) continue
        console.warn(`  warn ${table}: ${error.message}`)
        continue
      }
      if ((count ?? 0) > 0) {
        console.log(`  deleted ${table} org=${org.id}: ${count}`)
      }
    }
  }

  // 他ユーザー削除（auth → profiles CASCADE）
  for (const u of others) {
    if (DRY_RUN) {
      console.log(`  DRY_RUN would delete auth user: ${u.email} (${u.id})`)
      continue
    }
    const { error } = await service.auth.admin.deleteUser(u.id)
    if (error) throw new Error(`deleteUser ${u.email}: ${error.message}`)
    console.log(`  deleted auth user: ${u.email}`)
  }

  // 他事業所削除
  for (const org of orgsToDelete) {
    if (DRY_RUN) {
      console.log(`  DRY_RUN would delete org: ${org.name} (${org.id})`)
      continue
    }
    // profiles の参照を切る
    await service
      .from("profiles")
      .update({ organization_id: null })
      .eq("organization_id", org.id)
    const { error } = await service
      .from("organizations")
      .delete()
      .eq("id", org.id)
    if (error) throw new Error(`delete org ${org.id}: ${error.message}`)
    console.log(`  deleted org: ${org.name}`)
  }

  // ---- 3) KEEP を運営＋管理者に確保 ----
  console.log("\n--- ensure KEEP is admin + operator ---")
  if (DRY_RUN) {
    console.log("  DRY_RUN would set role=admin, is_operator=true, deleted_at=null")
  } else {
    const { error } = await service
      .from("profiles")
      .update({
        role: "admin",
        is_operator: true,
        deleted_at: null,
      })
      .eq("id", keep.id)
    if (error) throw new Error(`update keep profile: ${error.message}`)
    console.log("  updated KEEP profile: admin + operator")
  }

  console.log("\n--- counts after ---")
  for (const t of tables) {
    console.log(`  ${t}:`, await countRows(service, t))
  }

  if (DRY_RUN) {
    console.log(
      "\nDRY_RUN 完了。本番反映するには:\n  CONFIRM=YES npx tsx --env-file=.env.local scripts/reset-prod-rules-keep-operator.ts"
    )
  } else {
    console.log(
      "\n完了。次に npm run seed:rule-sources で参照URLを再投入し、市ルールブックから初回登録を進めてください。"
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
