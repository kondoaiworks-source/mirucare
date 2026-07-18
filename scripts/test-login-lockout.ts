/**
 * ログインロックの権限境界テスト（他事業所解除 → 403）
 *
 * 前提: .env.local + マイグレーション 20260719070000_login_lockout.sql 適用済み
 *
 *   npm run test:lockout
 */
import {
  unlockLoginForProfile,
  clearLoginLockout,
  recordFailedLogin,
  MAX_FAILED_LOGINS,
  isLockoutActive,
} from "../src/lib/login-lockout"
import { createClient } from "@supabase/supabase-js"

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  assert(url && key, "Supabase env missing")

  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profiles, error } = await service
    .from("profiles")
    .select("id, organization_id, role, failed_login_attempts, lockout_until")
    .is("deleted_at", null)
    .not("organization_id", "is", null)
    .limit(20)

  if (error?.message?.includes("failed_login_attempts")) {
    console.error(
      "FAIL: マイグレーション未適用です。SQL Editor で 20260719070000_login_lockout.sql を実行してください。"
    )
    process.exit(1)
  }

  assert(!error && profiles && profiles.length >= 1, "need at least 1 profile")

  const target = profiles[0]!
  const otherOrg = profiles.find(
    (p) =>
      p.organization_id &&
      p.organization_id !== target.organization_id &&
      p.role === "admin"
  )

  // --- 権限: 他事業所 / 不一致 org → 403（ロック状態不要）---
  if (otherOrg) {
    const denied = await unlockLoginForProfile({
      targetProfileId: target.id,
      actorProfileId: otherOrg.id,
      actorOrganizationId: otherOrg.organization_id,
      isOperator: false,
      isOrgAdmin: true,
    })
    assert(!denied.ok && denied.status === 403, "cross-org unlock must be 403")
    console.log("PASS: cross-org unlock returns 403")
  } else {
    const denied = await unlockLoginForProfile({
      targetProfileId: target.id,
      actorProfileId: target.id,
      actorOrganizationId: "00000000-0000-0000-0000-000000000099",
      isOperator: false,
      isOrgAdmin: true,
    })
    assert(!denied.ok && denied.status === 403, "mismatched org must be 403")
    console.log("PASS: mismatched org unlock returns 403")
  }

  // --- 5回失敗でロック ---
  await clearLoginLockout(target.id, service)
  for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
    const { data: row } = await service
      .from("profiles")
      .select("failed_login_attempts")
      .eq("id", target.id)
      .single()
    await recordFailedLogin(
      target.id,
      Number(row?.failed_login_attempts ?? 0),
      "lockout-test@example.com",
      service
    )
  }

  const { data: locked } = await service
    .from("profiles")
    .select("lockout_until, failed_login_attempts")
    .eq("id", target.id)
    .single()

  assert(
    locked && isLockoutActive(locked.lockout_until),
    "target should be locked after 5 failures"
  )
  console.log("PASS: lock after 5 failures")

  // --- 運営解除 ---
  const unlocked = await unlockLoginForProfile({
    targetProfileId: target.id,
    actorProfileId: target.id,
    actorOrganizationId: target.organization_id,
    isOperator: true,
    isOrgAdmin: false,
  })
  assert(unlocked.ok, "operator unlock should succeed")

  const { data: after } = await service
    .from("profiles")
    .select("lockout_until, failed_login_attempts")
    .eq("id", target.id)
    .single()

  assert(
    after &&
      after.failed_login_attempts === 0 &&
      after.lockout_until === null,
    "lockout should be cleared"
  )
  console.log("PASS: operator unlock clears lockout")
  console.log("ALL PASS")
}

main().catch((err) => {
  console.error("FAIL", err)
  process.exit(1)
})
