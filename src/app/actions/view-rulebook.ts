"use server"

import { revalidatePath } from "next/cache"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import { allocateAiCheckRuleCode } from "@/lib/rule-engine/allocate-rule-code"
import { ensureAuditItemOptions } from "@/lib/rule-engine/default-audit-item"
import { PHASE1_CITIES } from "@/lib/rule-engine/phase1-cities"
import { defaultEffectiveFrom } from "@/lib/knowledge/propose-rules"
import type { FindingSeverity } from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

function revalidateView() {
  revalidatePath("/admin/rules/services", "layout")
}

export async function addViewRulebookRuleAction(input: {
  title: string
  guidanceText: string
  severity: FindingSeverity
  jurisdictionId?: string | null
  citySlug?: string | null
  domainId?: string | null
  scopeKind?: "shared" | "city"
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const title = input.title.trim()
  const guidanceText = input.guidanceText.trim()
  const scopeKind = input.scopeKind === "shared" ? "shared" : "city"
  const jurisdictionId = input.jurisdictionId?.trim() || ""
  if (!title) return { ok: false, error: "ルール名を入力してください。" }
  if (!guidanceText) return { ok: false, error: "ルールを入力してください。" }
  if (scopeKind === "city" && !jurisdictionId) {
    return { ok: false, error: "自治体を選んでください。" }
  }

  const { data: juris } =
    scopeKind === "city" && jurisdictionId
      ? await op.service
          .from("rule_jurisdictions")
          .select("code, municipality_name, name")
          .eq("id", jurisdictionId)
          .maybeSingle()
      : { data: null }
  const slug =
    scopeKind === "city"
      ? input.citySlug?.trim() ||
        PHASE1_CITIES.find(
          (c) =>
            c.name === String(juris?.municipality_name || juris?.name || "") ||
            c.code === String(juris?.code ?? "")
        )?.slug
      : undefined

  const auditRes = await ensureAuditItemOptions(op.service)
  if (!auditRes.ok || auditRes.data.length === 0) {
    return {
      ok: false,
      error: auditRes.ok
        ? "判定ルールの土台を用意できませんでした。"
        : auditRes.error,
    }
  }

  const code = await allocateAiCheckRuleCode(op.service, {
    scopeKind,
    citySlug: slug,
  })

  const { data: rule, error: ruleError } = await op.service
    .from("ai_check_rules")
    .insert({
      audit_item_id: auditRes.data[0].id,
      code,
      title,
      target_doc_types: ["その他"],
      status: "active",
      scope_kind: scopeKind,
      jurisdiction_id: scopeKind === "city" ? jurisdictionId : null,
      domain_id: input.domainId?.trim() || null,
    })
    .select("id")
    .single()
  if (ruleError || !rule) {
    return { ok: false, error: toUserErrorMessage(ruleError) }
  }

  const { error: verError } = await op.service
    .from("ai_check_rule_versions")
    .insert({
      rule_id: rule.id,
      version_no: 1,
      check_logic: { type: "manual", notes: guidanceText },
      guidance_text: guidanceText,
      severity: input.severity,
      effective_from: defaultEffectiveFrom(),
      review_status: "approved",
      reviewed_by: op.userId,
      reviewed_at: new Date().toISOString(),
      review_reason: "ルールブック閲覧画面から追加",
      change_summary: "ルールブックへの手入力",
    })
  if (verError) return { ok: false, error: toUserErrorMessage(verError) }

  revalidateView()
  return { ok: true }
}

export async function updateViewRulebookGuidanceAction(input: {
  versionId: string
  guidanceText: string
  severity: FindingSeverity
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const versionId = input.versionId.trim()
  const guidanceText = input.guidanceText.trim()
  if (!versionId) return { ok: false, error: "対象が指定されていません。" }
  if (!guidanceText) return { ok: false, error: "ルールを入力してください。" }

  const { data: existing, error: fetchError } = await op.service
    .from("ai_check_rule_versions")
    .select("id, check_logic, effective_from")
    .eq("id", versionId)
    .maybeSingle()
  if (fetchError) return { ok: false, error: toUserErrorMessage(fetchError) }
  if (!existing) return { ok: false, error: "対象の版が見つかりません。" }

  const prevLogic =
    existing.check_logic && typeof existing.check_logic === "object"
      ? (existing.check_logic as Record<string, unknown>)
      : {}

  const { error } = await op.service
    .from("ai_check_rule_versions")
    .update({
      guidance_text: guidanceText,
      severity: input.severity,
      check_logic: { ...prevLogic, notes: guidanceText },
    })
    .eq("id", versionId)
  if (error) return { ok: false, error: toUserErrorMessage(error) }

  revalidateView()
  return { ok: true }
}

export async function retireViewRulebookRuleAction(input: {
  ruleId: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const ruleId = input.ruleId.trim()
  if (!ruleId) return { ok: false, error: "対象ルールが指定されていません。" }

  const { error } = await op.service
    .from("ai_check_rules")
    .update({ status: "retired" })
    .eq("id", ruleId)
  if (error) return { ok: false, error: toUserErrorMessage(error) }

  revalidateView()
  return { ok: true }
}

export async function deleteViewRulebookRuleAction(input: {
  ruleId: string
  versionId: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const ruleId = input.ruleId.trim()
  const versionId = input.versionId.trim()
  if (!ruleId || !versionId) {
    return { ok: false, error: "対象ルールが指定されていません。" }
  }

  const { error: deleteError } = await op.service
    .from("ai_check_rule_versions")
    .delete()
    .eq("id", versionId)
  if (deleteError) return { ok: false, error: toUserErrorMessage(deleteError) }

  const { count, error: countError } = await op.service
    .from("ai_check_rule_versions")
    .select("id", { count: "exact", head: true })
    .eq("rule_id", ruleId)
  if (countError) return { ok: false, error: toUserErrorMessage(countError) }

  if ((count ?? 0) === 0) {
    const { error: ruleDeleteError } = await op.service
      .from("ai_check_rules")
      .delete()
      .eq("id", ruleId)
    if (ruleDeleteError) {
      return { ok: false, error: toUserErrorMessage(ruleDeleteError) }
    }
  } else {
    const { error: retireError } = await op.service
      .from("ai_check_rules")
      .update({ status: "retired" })
      .eq("id", ruleId)
    if (retireError) return { ok: false, error: toUserErrorMessage(retireError) }
  }

  revalidateView()
  return { ok: true }
}
