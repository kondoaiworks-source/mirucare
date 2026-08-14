"use server"

import { revalidatePath } from "next/cache"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import { allocateAiCheckRuleCode } from "@/lib/rule-engine/allocate-rule-code"
import { ensureAuditItemOptions } from "@/lib/rule-engine/default-audit-item"
import {
  extraExistingRulesForDomain,
  findExistingRuleForTemplate,
  pickTemplateItemsForDomains,
  composeItemGuidance,
  composeItemTitle,
  defaultComposeSeverity,
  docTypesForTemplateCategory,
  templateCodeFromCheckLogic,
  type ExistingComposeRule,
} from "@/lib/rule-engine/compose-rulebook"
import { resolveSelectedDomains } from "@/lib/rule-engine/domains"
import { HOME_VISIT_AUDIT_TEMPLATE_ITEMS } from "@/lib/rule-engine/home-visit-audit-template"
import { getPhase1CityBySlug, PHASE1_CITIES } from "@/lib/rule-engine/phase1-cities"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { defaultEffectiveFrom } from "@/lib/knowledge/propose-rules"
import type {
  AiCheckRule,
  AiCheckRuleVersion,
  FindingSeverity,
  RuleDomain,
  RuleJurisdiction,
  RulebookComposeItem,
  RulebookComposeJob,
} from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

export type ComposeJobItemView = RulebookComposeItem & {
  rule: Pick<
    AiCheckRule,
    "id" | "code" | "title" | "status" | "scope_kind" | "jurisdiction_id" | "domain_id"
  > | null
  version: Pick<
    AiCheckRuleVersion,
    | "id"
    | "version_no"
    | "guidance_text"
    | "severity"
    | "effective_from"
    | "review_status"
    | "change_summary"
  > | null
  domainTitle: string | null
}

export type ComposeJobView = {
  job: RulebookComposeJob
  serviceLabel: string
  cityName: string
  citySlug: string | null
  domainLabel: string
  domains: RuleDomain[]
  items: ComposeJobItemView[]
  includedCount: number
  pendingCount: number
}

function revalidateCompose(serviceSlug?: string) {
  revalidatePath("/admin/rules/services", "layout")
  if (serviceSlug) {
    revalidatePath(`/admin/rules/services/${serviceSlug}/compose`)
  }
}

function asDomain(row: Record<string, unknown>): RuleDomain {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    keywords: Array.isArray(row.keywords)
      ? row.keywords.map((k) => String(k))
      : [],
    template_categories: Array.isArray(row.template_categories)
      ? row.template_categories.map((k) => String(k))
      : [],
    template_codes: Array.isArray(row.template_codes)
      ? row.template_codes.map((k) => String(k))
      : [],
    sort_order: Number(row.sort_order) || 0,
    status: row.status === "retired" ? "retired" : "active",
    is_system: Boolean(row.is_system),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  }
}

function domainMatchInput(d: RuleDomain) {
  return {
    id: d.id,
    slug: d.slug,
    title: d.title,
    keywords: d.keywords,
    templateCategories: d.template_categories,
    templateCodes: d.template_codes,
  }
}

export async function listComposeOptionsAction(input: {
  serviceSlug: string
}): Promise<
  ActionResult<{
    domains: RuleDomain[]
    municipalities: Array<{
      id: string
      name: string
      slug: string | null
    }>
  }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }
  const service = getRuleServiceBySlug(input.serviceSlug)
  if (!service) return { ok: false, error: "介護サービスが見つかりません。" }

  const [domainsRes, jurisRes] = await Promise.all([
    op.service
      .from("rule_domains")
      .select("*")
      .eq("status", "active")
      .order("sort_order", { ascending: true }),
    op.service
      .from("rule_jurisdictions")
      .select("id, name, code, municipality_name, is_supported, level")
      .eq("level", "municipality")
      .eq("is_supported", true)
      .order("sort_order", { ascending: true }),
  ])

  if (domainsRes.error) {
    return { ok: false, error: toUserErrorMessage(domainsRes.error) }
  }
  if (jurisRes.error) {
    return { ok: false, error: toUserErrorMessage(jurisRes.error) }
  }

  const municipalities = ((jurisRes.data ?? []) as Array<Record<string, unknown>>)
    .map((j) => {
      const name = String(j.municipality_name || j.name || "")
      const city = PHASE1_CITIES.find(
        (c) => c.name === name || c.code === String(j.code)
      )
      return {
        id: String(j.id),
        name,
        slug: city?.slug ?? null,
      }
    })
    .filter((m) => m.name)

  return {
    ok: true,
    data: {
      domains: (domainsRes.data ?? []).map((r) =>
        asDomain(r as Record<string, unknown>)
      ),
      municipalities,
    },
  }
}

async function loadScopedRules(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  cityJurisdictionId: string
): Promise<
  Array<
    ExistingComposeRule & {
      raw: AiCheckRule
      latestVersion: AiCheckRuleVersion | null
    }
  >
> {
  const { data, error } = await service
    .from("ai_check_rules")
    .select(
      `
      id, code, title, status, scope_kind, jurisdiction_id, domain_id, audit_item_id,
      ai_check_rule_versions (
        id, version_no, guidance_text, severity, effective_from, review_status,
        change_summary, check_logic
      )
    `
    )
    .eq("status", "active")
    .limit(400)

  if (error || !data) return []

  const rows: Array<
    ExistingComposeRule & {
      raw: AiCheckRule
      latestVersion: AiCheckRuleVersion | null
    }
  > = []

  for (const row of data as Array<Record<string, unknown>>) {
    const scopeKind = row.scope_kind === "city" ? "city" : "shared"
    const jurisdictionId = (row.jurisdiction_id as string | null) ?? null
    if (scopeKind === "city" && jurisdictionId !== cityJurisdictionId) {
      continue
    }
    const versions = Array.isArray(row.ai_check_rule_versions)
      ? (row.ai_check_rule_versions as AiCheckRuleVersion[])
      : []
    versions.sort((a, b) => Number(b.version_no) - Number(a.version_no))
    const latest = versions[0] ?? null
    const templateCode = templateCodeFromCheckLogic(
      latest?.check_logic as Record<string, unknown> | null
    )
    rows.push({
      id: String(row.id),
      code: String(row.code ?? ""),
      title: String(row.title ?? ""),
      domainId: (row.domain_id as string | null) ?? null,
      templateCode,
      raw: row as unknown as AiCheckRule,
      latestVersion: latest,
    })
  }
  return rows
}

export async function startComposeRulebookAction(input: {
  serviceSlug: string
  domainValue: string
  jurisdictionId: string
}): Promise<ActionResult<{ jobId: string }>> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const serviceDef = getRuleServiceBySlug(input.serviceSlug)
  if (!serviceDef) return { ok: false, error: "介護サービスが見つかりません。" }

  const jurisdictionId = input.jurisdictionId.trim()
  if (!jurisdictionId) {
    return { ok: false, error: "自治体を選択してください。" }
  }

  const { data: city, error: cityError } = await op.service
    .from("rule_jurisdictions")
    .select("id, name, municipality_name, code, level, is_supported")
    .eq("id", jurisdictionId)
    .maybeSingle()
  if (cityError) return { ok: false, error: toUserErrorMessage(cityError) }
  if (!city || city.level !== "municipality" || !city.is_supported) {
    return { ok: false, error: "対象の自治体が見つかりません。" }
  }

  const { data: domainRows, error: domainError } = await op.service
    .from("rule_domains")
    .select("*")
    .order("sort_order", { ascending: true })
  if (domainError) return { ok: false, error: toUserErrorMessage(domainError) }

  const allDomains = (domainRows ?? []).map((r) =>
    asDomain(r as Record<string, unknown>)
  )
  const selected = resolveSelectedDomains(input.domainValue, allDomains)
  if ("error" in selected) return { ok: false, error: selected.error }

  const domainIds = selected.domains.map((d) => d.id)
  const jobDomainId = selected.all ? null : selected.domains[0]?.id ?? null

  const existingJobQuery = op.service
    .from("rulebook_compose_jobs")
    .select("id")
    .eq("service_type", serviceDef.serviceType)
    .eq("jurisdiction_id", jurisdictionId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)

  const { data: openJobs } = jobDomainId
    ? await existingJobQuery.eq("domain_id", jobDomainId)
    : await existingJobQuery.is("domain_id", null)

  const openId = (openJobs?.[0] as { id?: string } | undefined)?.id
  let jobId = openId ?? null
  if (jobId) {
    const { count } = await op.service
      .from("rulebook_compose_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
    if ((count ?? 0) > 0) {
      return { ok: true, data: { jobId } }
    }
  }

  if (!jobId) {
    const { data: job, error: jobError } = await op.service
      .from("rulebook_compose_jobs")
      .insert({
        service_type: serviceDef.serviceType,
        domain_id: jobDomainId,
        domain_ids: domainIds,
        jurisdiction_id: jurisdictionId,
        status: "draft",
        created_by: op.userId,
      })
      .select("id")
      .single()

    if (jobError || !job) {
      return { ok: false, error: toUserErrorMessage(jobError) }
    }
    jobId = job.id as string
  }

  if (!jobId) {
    return { ok: false, error: "下書きを開始できませんでした。" }
  }

  const job = { id: jobId }

  const auditRes = await ensureAuditItemOptions(op.service)
  if (!auditRes.ok || auditRes.data.length === 0) {
    return {
      ok: false,
      error: auditRes.ok
        ? "判定ルールの土台を用意できませんでした。"
        : auditRes.error,
    }
  }
  const auditItemId = auditRes.data[0].id

  const existingRules = await loadScopedRules(op.service, jurisdictionId)
  const picks = pickTemplateItemsForDomains({
    items: HOME_VISIT_AUDIT_TEMPLATE_ITEMS,
    domains: selected.domains.map(domainMatchInput),
  })

  const pickedIds = new Set<string>()
  const effectiveFrom = defaultEffectiveFrom()

  for (const pick of picks) {
    const found = findExistingRuleForTemplate(existingRules, pick.item)
    if (found) {
      pickedIds.add(found.id)
      const { error: existingItemError } = await op.service
        .from("rulebook_compose_items")
        .insert({
          job_id: job.id,
          rule_id: found.id,
          domain_id: pick.domainId,
          origin: "existing",
          included: true,
        })
      if (existingItemError) {
        return { ok: false, error: toUserErrorMessage(existingItemError) }
      }
      if (!found.domainId) {
        await op.service
          .from("ai_check_rules")
          .update({ domain_id: pick.domainId })
          .eq("id", found.id)
          .is("domain_id", null)
      }
      continue
    }

    const title = composeItemTitle(pick.item)
    const code = await allocateAiCheckRuleCode(op.service, {
      scopeKind: "shared",
    })
    const { data: rule, error: ruleError } = await op.service
      .from("ai_check_rules")
      .insert({
        audit_item_id: auditItemId,
        code,
        title,
        target_doc_types: docTypesForTemplateCategory(pick.item.category),
        status: "active",
        scope_kind: "shared",
        jurisdiction_id: null,
        domain_id: pick.domainId,
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
        check_logic: {
          type: "template",
          templateCode: pick.item.code,
          notes: composeItemGuidance(pick.item),
        },
        guidance_text: composeItemGuidance(pick.item),
        severity: defaultComposeSeverity(pick.item),
        effective_from: effectiveFrom,
        review_status: "pending_review",
        change_summary: `領域テンプレから下書き（${pick.item.section}）`,
      })

    if (verError) {
      return { ok: false, error: toUserErrorMessage(verError) }
    }

    pickedIds.add(rule.id as string)
    const { error: templateItemError } = await op.service
      .from("rulebook_compose_items")
      .insert({
        job_id: job.id,
        rule_id: rule.id,
        domain_id: pick.domainId,
        origin: "template",
        included: true,
      })
    if (templateItemError) {
      return { ok: false, error: toUserErrorMessage(templateItemError) }
    }
  }

  for (const domain of selected.domains) {
    const extras = extraExistingRulesForDomain(
      existingRules,
      domainMatchInput(domain),
      pickedIds
    )
    for (const extra of extras) {
      pickedIds.add(extra.id)
      const { error: extraItemError } = await op.service
        .from("rulebook_compose_items")
        .insert({
          job_id: job.id,
          rule_id: extra.id,
          domain_id: domain.id,
          origin: "existing",
          included: true,
        })
      if (extraItemError) {
        return { ok: false, error: toUserErrorMessage(extraItemError) }
      }
    }
  }

  revalidateCompose(input.serviceSlug)
  return { ok: true, data: { jobId: job.id as string } }
}

export async function getComposeJobAction(input: {
  jobId: string
}): Promise<ActionResult<ComposeJobView>> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const jobId = input.jobId.trim()
  if (!jobId) return { ok: false, error: "下書きが指定されていません。" }

  const { data: jobRow, error: jobError } = await op.service
    .from("rulebook_compose_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle()
  if (jobError) return { ok: false, error: toUserErrorMessage(jobError) }
  if (!jobRow) return { ok: false, error: "下書きが見つかりません。" }

  const job = jobRow as RulebookComposeJob

  const [itemsRes, domainsRes, jurisRes] = await Promise.all([
    op.service
      .from("rulebook_compose_items")
      .select(
        `
        *,
        ai_check_rules (
          id, code, title, status, scope_kind, jurisdiction_id, domain_id
        )
      `
      )
      .eq("job_id", jobId)
      .order("created_at", { ascending: true }),
    op.service.from("rule_domains").select("*"),
    op.service
      .from("rule_jurisdictions")
      .select("id, name, municipality_name, code")
      .eq("id", job.jurisdiction_id)
      .maybeSingle(),
  ])

  if (itemsRes.error) {
    return { ok: false, error: toUserErrorMessage(itemsRes.error) }
  }
  if (domainsRes.error) {
    return { ok: false, error: toUserErrorMessage(domainsRes.error) }
  }

  const domains = (domainsRes.data ?? []).map((r) =>
    asDomain(r as Record<string, unknown>)
  )
  const domainById = new Map(domains.map((d) => [d.id, d]))

  const ruleIds = ((itemsRes.data ?? []) as Array<Record<string, unknown>>)
    .map((r) => String(r.rule_id))
    .filter(Boolean)

  const versionsByRule = new Map<string, AiCheckRuleVersion>()
  if (ruleIds.length > 0) {
    const { data: versions } = await op.service
      .from("ai_check_rule_versions")
      .select(
        "id, rule_id, version_no, guidance_text, severity, effective_from, review_status, change_summary"
      )
      .in("rule_id", ruleIds)
      .order("version_no", { ascending: false })
    for (const ver of (versions ?? []) as AiCheckRuleVersion[]) {
      if (!versionsByRule.has(ver.rule_id)) {
        versionsByRule.set(ver.rule_id, ver)
      }
    }
  }

  const items: ComposeJobItemView[] = (
    (itemsRes.data ?? []) as Array<Record<string, unknown>>
  ).map((row) => {
    const ruleRaw = row.ai_check_rules
    const rule = (
      Array.isArray(ruleRaw) ? ruleRaw[0] : ruleRaw
    ) as ComposeJobItemView["rule"]
    const domainId = (row.domain_id as string | null) ?? rule?.domain_id ?? null
    return {
      id: String(row.id),
      job_id: String(row.job_id),
      rule_id: String(row.rule_id),
      domain_id: domainId,
      origin: (row.origin as RulebookComposeItem["origin"]) ?? "existing",
      included: row.included !== false,
      created_at: String(row.created_at ?? ""),
      rule,
      version: versionsByRule.get(String(row.rule_id)) ?? null,
      domainTitle: domainId ? domainById.get(domainId)?.title ?? null : null,
    }
  })

  const juris = jurisRes.data as Pick<
    RuleJurisdiction,
    "name" | "municipality_name" | "code"
  > | null
  const cityName = String(juris?.municipality_name || juris?.name || "")
  const citySlug =
    getPhase1CityBySlug(
      PHASE1_CITIES.find(
        (c) => c.name === cityName || c.code === String(juris?.code ?? "")
      )?.slug ?? ""
    )?.slug ??
    PHASE1_CITIES.find((c) => c.name === cityName)?.slug ??
    null

  const serviceLabel =
    job.service_type === "訪問介護"
      ? "訪問介護"
      : job.service_type === "通所介護"
        ? "通所介護"
        : String(job.service_type)

  const domainLabel = job.domain_id
    ? domainById.get(job.domain_id)?.title ?? "領域"
    : "全て"

  const included = items.filter((i) => i.included)
  const pendingCount = included.filter(
    (i) => i.version?.review_status === "pending_review"
  ).length

  return {
    ok: true,
    data: {
      job,
      serviceLabel,
      cityName,
      citySlug,
      domainLabel,
      domains,
      items,
      includedCount: included.length,
      pendingCount,
    },
  }
}

export async function setComposeItemIncludedAction(input: {
  itemId: string
  included: boolean
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const itemId = input.itemId.trim()
  if (!itemId) return { ok: false, error: "対象が指定されていません。" }

  const { data: item, error: fetchError } = await op.service
    .from("rulebook_compose_items")
    .select("id, job_id, rule_id, origin, included")
    .eq("id", itemId)
    .maybeSingle()
  if (fetchError) return { ok: false, error: toUserErrorMessage(fetchError) }
  if (!item) return { ok: false, error: "対象が見つかりません。" }

  const { data: job } = await op.service
    .from("rulebook_compose_jobs")
    .select("id, status")
    .eq("id", item.job_id)
    .maybeSingle()
  if (!job || job.status !== "draft") {
    return { ok: false, error: "確定済みの下書きは変更できません。" }
  }

  if (!input.included && item.origin === "template") {
    const { data: version } = await op.service
      .from("ai_check_rule_versions")
      .select("id, review_status")
      .eq("rule_id", item.rule_id)
      .eq("review_status", "pending_review")
      .maybeSingle()
    if (version) {
      await op.service
        .from("rulebook_compose_items")
        .delete()
        .eq("id", itemId)
      await op.service
        .from("ai_check_rule_versions")
        .delete()
        .eq("id", version.id)
      const { count } = await op.service
        .from("ai_check_rule_versions")
        .select("id", { count: "exact", head: true })
        .eq("rule_id", item.rule_id)
      if ((count ?? 0) === 0) {
        await op.service.from("ai_check_rules").delete().eq("id", item.rule_id)
      }
      revalidateCompose()
      return { ok: true }
    }
  }

  const { error } = await op.service
    .from("rulebook_compose_items")
    .update({ included: input.included })
    .eq("id", itemId)
  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateCompose()
  return { ok: true }
}

export async function addComposeManualRuleAction(input: {
  jobId: string
  title: string
  guidanceText: string
  severity: FindingSeverity
  domainId?: string | null
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const jobId = input.jobId.trim()
  const title = input.title.trim()
  const guidanceText = input.guidanceText.trim()
  if (!jobId) return { ok: false, error: "下書きが指定されていません。" }
  if (!title) return { ok: false, error: "ルール名を入力してください。" }
  if (!guidanceText) {
    return { ok: false, error: "案内文を入力してください。" }
  }

  const { data: job, error: jobError } = await op.service
    .from("rulebook_compose_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle()
  if (jobError) return { ok: false, error: toUserErrorMessage(jobError) }
  if (!job || job.status !== "draft") {
    return { ok: false, error: "この下書きには追加できません。" }
  }

  const { data: juris } = await op.service
    .from("rule_jurisdictions")
    .select("code, municipality_name, name")
    .eq("id", job.jurisdiction_id)
    .maybeSingle()
  const slug = PHASE1_CITIES.find(
    (c) =>
      c.name === String(juris?.municipality_name || juris?.name || "") ||
      c.code === String(juris?.code ?? "")
  )?.slug

  const domainId =
    input.domainId?.trim() ||
    (job.domain_id as string | null) ||
    (Array.isArray(job.domain_ids) ? (job.domain_ids[0] as string) : null)

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
    scopeKind: "city",
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
      scope_kind: "city",
      jurisdiction_id: job.jurisdiction_id,
      domain_id: domainId,
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
      review_status: "pending_review",
      change_summary: "ルールブック下書きへの手入力",
    })
  if (verError) return { ok: false, error: toUserErrorMessage(verError) }

  const { error: itemError } = await op.service
    .from("rulebook_compose_items")
    .insert({
      job_id: jobId,
      rule_id: rule.id,
      domain_id: domainId,
      origin: "manual",
      included: true,
    })
  if (itemError) return { ok: false, error: toUserErrorMessage(itemError) }

  revalidateCompose()
  return { ok: true }
}

export async function confirmComposeJobAction(input: {
  jobId: string
  note?: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const jobId = input.jobId.trim()
  if (!jobId) return { ok: false, error: "下書きが指定されていません。" }

  const loaded = await getComposeJobAction({ jobId })
  if (!loaded.ok || !loaded.data) {
    return { ok: false, error: loaded.error }
  }
  if (loaded.data.job.status !== "draft") {
    return { ok: false, error: "この下書きはすでに確定または破棄されています。" }
  }

  const reason =
    input.note?.trim() ||
    "内容を確認し、このルールブックを確定します。"

  const pending = loaded.data.items.filter(
    (i) => i.included && i.version?.review_status === "pending_review"
  )
  for (const item of pending) {
    if (!item.version) continue
    const { error } = await op.service
      .from("ai_check_rule_versions")
      .update({
        review_status: "approved",
        reviewed_by: op.userId,
        reviewed_at: new Date().toISOString(),
        review_reason: reason,
      })
      .eq("id", item.version.id)
      .eq("review_status", "pending_review")
    if (error) return { ok: false, error: toUserErrorMessage(error) }
  }

  const { error } = await op.service
    .from("rulebook_compose_jobs")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: op.userId,
    })
    .eq("id", jobId)
    .eq("status", "draft")
  if (error) return { ok: false, error: toUserErrorMessage(error) }

  revalidateCompose()
  revalidatePath("/admin/rules/pending")
  revalidatePath("/admin/rules/ai-rules")
  return { ok: true }
}

export async function discardComposeJobAction(input: {
  jobId: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const jobId = input.jobId.trim()
  if (!jobId) return { ok: false, error: "下書きが指定されていません。" }

  const { data: job, error: fetchError } = await op.service
    .from("rulebook_compose_jobs")
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle()
  if (fetchError) return { ok: false, error: toUserErrorMessage(fetchError) }
  if (!job) return { ok: false, error: "下書きが見つかりません。" }
  if (job.status !== "draft") {
    return { ok: false, error: "この下書きは破棄できません。" }
  }

  const { data: items } = await op.service
    .from("rulebook_compose_items")
    .select("id, rule_id, origin")
    .eq("job_id", jobId)

  for (const item of items ?? []) {
    if (item.origin !== "template" && item.origin !== "manual") continue
    const { data: version } = await op.service
      .from("ai_check_rule_versions")
      .select("id")
      .eq("rule_id", item.rule_id)
      .eq("review_status", "pending_review")
      .maybeSingle()
    if (!version) continue
    await op.service.from("ai_check_rule_versions").delete().eq("id", version.id)
    const { count } = await op.service
      .from("ai_check_rule_versions")
      .select("id", { count: "exact", head: true })
      .eq("rule_id", item.rule_id)
    if ((count ?? 0) === 0) {
      await op.service.from("ai_check_rules").delete().eq("id", item.rule_id)
    }
  }

  const { error } = await op.service
    .from("rulebook_compose_jobs")
    .update({ status: "discarded" })
    .eq("id", jobId)
  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateCompose()
  return { ok: true }
}

export async function retireComposeRuleAction(input: {
  ruleId: string
  itemId: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const ruleId = input.ruleId.trim()
  const itemId = input.itemId.trim()
  if (!ruleId) return { ok: false, error: "対象ルールが指定されていません。" }

  const { error } = await op.service
    .from("ai_check_rules")
    .update({ status: "retired" })
    .eq("id", ruleId)
  if (error) return { ok: false, error: toUserErrorMessage(error) }

  if (itemId) {
    await op.service
      .from("rulebook_compose_items")
      .update({ included: false })
      .eq("id", itemId)
  }
  revalidateCompose()
  return { ok: true }
}

export async function updateComposeItemGuidanceAction(input: {
  versionId: string
  guidanceText: string
  severity: FindingSeverity
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const versionId = input.versionId.trim()
  const guidanceText = input.guidanceText.trim()
  if (!versionId) return { ok: false, error: "対象が指定されていません。" }
  if (!guidanceText) return { ok: false, error: "案内文を入力してください。" }

  const { data: existing, error: fetchError } = await op.service
    .from("ai_check_rule_versions")
    .select("id, check_logic, review_status, effective_from")
    .eq("id", versionId)
    .maybeSingle()
  if (fetchError) return { ok: false, error: toUserErrorMessage(fetchError) }
  if (!existing) return { ok: false, error: "対象の版が見つかりません。" }
  if (existing.review_status === "approved") {
    return {
      ok: false,
      error:
        "確定済みの案内文は、ここでは直接直せません。下書きから外すか、判定ルール管理で修正案を出してください。",
    }
  }

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
  revalidateCompose()
  return { ok: true }
}
