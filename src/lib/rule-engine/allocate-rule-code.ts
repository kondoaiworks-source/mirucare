import {
  formatAllocatedRuleCode,
  ruleCodePrefix,
  type CheckRuleManageContext,
} from "@/lib/rule-engine/check-rule-scope"

type AdminLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any
}

export async function allocateAiCheckRuleCode(
  service: AdminLike,
  context: Pick<CheckRuleManageContext, "scopeKind" | "citySlug">
): Promise<string> {
  const prefix = ruleCodePrefix({
    serviceSlug: "homecare",
    serviceLabel: "",
    scopeKind: context.scopeKind,
    jurisdictionId: null,
    citySlug: context.citySlug,
  })
  const { data, error } = await service.rpc("allocate_ai_check_rule_code", {
    p_prefix: prefix,
  })
  if (!error && typeof data === "string" && data.trim()) {
    return data.trim().toUpperCase()
  }
  const fallback = formatAllocatedRuleCode(
    prefix,
    Math.floor(Date.now() % 1_000_000)
  )
  return `${fallback}${crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}`
}
