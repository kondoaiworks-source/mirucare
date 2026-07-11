/**
 * RLS 事業所分離の自動テスト（受け入れ条件 [1]）
 *
 * 実行前提:
 * - マイグレーション適用済み
 * - .env.local に SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 *
 * 実行:
 *   npx tsx --env-file=.env.local scripts/test-rls-isolation.ts
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  assert(url && anon && service, "Supabase 環境変数が不足しています")

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const stamp = Date.now()
  const emailA = `rls-a-${stamp}@example.com`
  const emailB = `rls-b-${stamp}@example.com`
  const password = "TestPass123!"

  const { data: createdA, error: errA } = await admin.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
    user_metadata: { display_name: "RLSテストA" },
  })
  assert(!errA && createdA.user, `ユーザーA作成失敗: ${errA?.message}`)

  const { data: createdB, error: errB } = await admin.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
    user_metadata: { display_name: "RLSテストB" },
  })
  assert(!errB && createdB.user, `ユーザーB作成失敗: ${errB?.message}`)

  const userA = createdA.user!
  const userB = createdB.user!

  // A でオンボーディング
  const clientA = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInA } = await clientA.auth.signInWithPassword({
    email: emailA,
    password,
  })
  assert(!signInA, `Aログイン失敗: ${signInA?.message}`)

  const { data: orgAId, error: onboardA } = await clientA.rpc(
    "complete_onboarding",
    {
      p_name: `[RLSテスト]事業所A-${stamp}`,
      p_service_type: "訪問介護",
      p_municipality: "横浜市",
      p_skip_municipality: false,
    }
  )
  assert(!onboardA && orgAId, `Aオンボーディング失敗: ${onboardA?.message}`)

  // B でオンボーディング
  const clientB = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInB } = await clientB.auth.signInWithPassword({
    email: emailB,
    password,
  })
  assert(!signInB, `Bログイン失敗: ${signInB?.message}`)

  const { data: orgBId, error: onboardB } = await clientB.rpc(
    "complete_onboarding",
    {
      p_name: `[RLSテスト]事業所B-${stamp}`,
      p_service_type: "通所介護",
      p_municipality: "大阪市",
      p_skip_municipality: false,
    }
  )
  assert(!onboardB && orgBId, `Bオンボーディング失敗: ${onboardB?.message}`)

  // A から organizations を SELECT → B の事業所が見えないこと
  const { data: orgsForA, error: selectA } = await clientA
    .from("organizations")
    .select("id, name")

  assert(!selectA, `AのSELECT失敗: ${selectA?.message}`)
  assert(orgsForA?.length === 1, `Aは自事業所のみ見えるべき (got ${orgsForA?.length})`)
  assert(
    orgsForA![0].id === orgAId,
    "Aに返った事業所IDが自事業所と一致しません"
  )
  assert(
    !orgsForA!.some((o) => o.id === orgBId),
    "FAIL: ユーザーAから事業所Bのデータが見えています（RLS違反）"
  )

  // A から B の profiles が見えないこと
  const { data: profilesForA, error: profilesErr } = await clientA
    .from("profiles")
    .select("id, organization_id")

  assert(!profilesErr, `Aのprofiles SELECT失敗: ${profilesErr?.message}`)
  assert(
    !profilesForA!.some((p) => p.id === userB.id),
    "FAIL: ユーザーAから事業所Bのプロファイルが見えています（RLS違反）"
  )

  console.log("PASS: RLS 事業所分離テスト成功（別事業所のデータは一切見えない）")

  // クリーンアップ（論理削除ではなくテスト用に物理削除）
  await admin.from("profiles").delete().in("id", [userA.id, userB.id])
  await admin.from("organizations").delete().in("id", [orgAId, orgBId])
  await admin.auth.admin.deleteUser(userA.id)
  await admin.auth.admin.deleteUser(userB.id)
}

main().catch((error) => {
  console.error("FAIL:", error instanceof Error ? error.message : error)
  process.exit(1)
})
