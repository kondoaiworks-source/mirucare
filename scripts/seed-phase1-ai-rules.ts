/**
 * Phase1 AI 判定ルールをシードする（運営向け CLI）
 *
 * 前提: .env.local / 訪問介護テンプレート監査項目が投入済み
 *   npm run seed:phase1-ai-rules
 */
import { createClient } from "@supabase/supabase-js"
import { PHASE1_AI_RULE_SEEDS } from "../src/lib/phase1-ai-rules-seed"

async function main() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!url || !key) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です")
    process.exit(1)
  }

  const operatorId = process.env.SEED_OPERATOR_PROFILE_ID?.trim()
  if (!operatorId) {
    console.error(
      "SEED_OPERATOR_PROFILE_ID（profiles.id）を指定してください。承認者として記録します。"
    )
    process.exit(1)
  }

  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const today = new Date()
  const effectiveFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  const auditCodes = Array.from(
    new Set(PHASE1_AI_RULE_SEEDS.map((s) => s.auditItemCode))
  )
  const { data: auditRows, error: auditError } = await service
    .from("audit_items")
    .select("id, code")
    .in("code", auditCodes)
    .eq("status", "active")

  if (auditError) {
    console.error(auditError.message)
    process.exit(1)
  }

  const auditByCode = new Map<string, string>()
  for (const row of auditRows ?? []) {
    if (!auditByCode.has(String(row.code))) {
      auditByCode.set(String(row.code), String(row.id))
    }
  }

  const { data: existingRules } = await service
    .from("ai_check_rules")
    .select("code")
    .in(
      "code",
      PHASE1_AI_RULE_SEEDS.map((s) => s.code)
    )
  const existing = new Set((existingRules ?? []).map((r) => String(r.code)))

  let inserted = 0
  let skipped = 0
  const missing: string[] = []

  for (const seed of PHASE1_AI_RULE_SEEDS) {
    if (existing.has(seed.code)) {
      skipped += 1
      continue
    }
    const auditItemId = auditByCode.get(seed.auditItemCode)
    if (!auditItemId) {
      missing.push(seed.auditItemCode)
      skipped += 1
      continue
    }

    const { data: rule, error: ruleError } = await service
      .from("ai_check_rules")
      .insert({
        audit_item_id: auditItemId,
        code: seed.code,
        title: seed.title,
        target_doc_types: seed.targetDocTypes,
        status: "active",
      })
      .select("id")
      .single()

    if (ruleError || !rule) {
      console.error(seed.code, ruleError?.message)
      process.exit(1)
    }

    const { error: verError } = await service
      .from("ai_check_rule_versions")
      .insert({
        rule_id: rule.id,
        version_no: 1,
        check_logic: { type: "heuristic", notes: seed.guidanceText, phase1: true },
        guidance_text: seed.guidanceText,
        severity: seed.severity,
        effective_from: effectiveFrom,
        review_status: "approved",
        change_summary: "Phase1初期シード（CLI）",
        review_reason: "Phase1運用開始のための初期シード（CLI）",
        reviewed_at: new Date().toISOString(),
        reviewed_by: operatorId,
      })

    if (verError) {
      console.error(seed.code, verError.message)
      process.exit(1)
    }
    inserted += 1
  }

  console.log(
    JSON.stringify({ inserted, skipped, missing: Array.from(new Set(missing)) }, null, 2)
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
