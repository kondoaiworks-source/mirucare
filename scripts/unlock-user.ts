/**
 * ログインロック解除 CLI（service role）
 *
 * 使い方:
 *   npm run unlock-user -- --email=user@example.com
 */
import { createClient } from "@supabase/supabase-js"

async function main() {
  const emailArg = process.argv.find((a) => a.startsWith("--email="))
  const email = emailArg?.slice("--email=".length)?.trim().toLowerCase()

  if (!email || !email.includes("@")) {
    console.error("使い方: npm run unlock-user -- --email=user@example.com")
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です")
    process.exit(1)
  }

  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await service.rpc("lookup_login_lockout", {
    p_email: email,
  })

  if (error) {
    console.error("lookup failed:", error.message)
    process.exit(1)
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.profile_id) {
    console.error("ユーザーが見つかりません（未登録メールの可能性）")
    process.exit(1)
  }

  const { error: updateError } = await service
    .from("profiles")
    .update({ failed_login_attempts: 0, lockout_until: null })
    .eq("id", row.profile_id)

  if (updateError) {
    console.error("unlock failed:", updateError.message)
    process.exit(1)
  }

  await service.from("auth_audit_log").insert({
    action: "login_unlock",
    profile_id: row.profile_id,
    email_masked: email.replace(/^(.{0,2}).*(@.*)$/, "$1***$2"),
    meta: { by: "cli" },
  })

  console.log(`OK: unlocked profile ${row.profile_id} (${email})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
