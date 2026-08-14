"use server"

import { revalidatePath } from "next/cache"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import {
  allocateDomainSlug,
  canDeleteDomain,
  parseCodeList,
  parseKeywordInput,
} from "@/lib/rule-engine/domains"
import type { RuleDomain } from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

function revalidateDomainPaths() {
  revalidatePath("/admin/rules/domains")
  revalidatePath("/admin/rules/setup")
  revalidatePath("/admin/rules/services", "layout")
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

export async function listRuleDomainsAction(): Promise<
  ActionResult<{ rows: RuleDomain[] }>
> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const { data, error } = await op.service
    .from("rule_domains")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  return {
    ok: true,
    data: { rows: (data ?? []).map((r) => asDomain(r as Record<string, unknown>)) },
  }
}

export async function createRuleDomainAction(input: {
  title: string
  description?: string
  keywords?: string
  templateCategories?: string
  templateCodes?: string
}): Promise<ActionResult<{ id: string }>> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const title = input.title.trim()
  if (!title) return { ok: false, error: "領域名を入力してください。" }

  const { data: existing, error: existingError } = await op.service
    .from("rule_domains")
    .select("slug, sort_order")
  if (existingError) {
    return { ok: false, error: toUserErrorMessage(existingError) }
  }
  const slugs = (existing ?? []).map((r) => String(r.slug))
  const maxOrder = (existing ?? []).reduce(
    (m, r) => Math.max(m, Number(r.sort_order) || 0),
    0
  )
  const slug = allocateDomainSlug(title, slugs)

  const { data, error } = await op.service
    .from("rule_domains")
    .insert({
      slug,
      title,
      description: input.description?.trim() || "",
      keywords: parseKeywordInput(input.keywords ?? ""),
      template_categories: parseKeywordInput(input.templateCategories ?? ""),
      template_codes: parseCodeList(input.templateCodes ?? ""),
      sort_order: maxOrder + 10,
      status: "active",
      is_system: false,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: toUserErrorMessage(error) }
  }
  revalidateDomainPaths()
  return { ok: true, data: { id: data.id as string } }
}

export async function updateRuleDomainAction(input: {
  id: string
  title: string
  description?: string
  keywords?: string
  templateCategories?: string
  templateCodes?: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const id = input.id.trim()
  const title = input.title.trim()
  if (!id) return { ok: false, error: "領域が指定されていません。" }
  if (!title) return { ok: false, error: "領域名を入力してください。" }

  const { error } = await op.service
    .from("rule_domains")
    .update({
      title,
      description: input.description?.trim() || "",
      keywords: parseKeywordInput(input.keywords ?? ""),
      template_categories: parseKeywordInput(input.templateCategories ?? ""),
      template_codes: parseCodeList(input.templateCodes ?? ""),
    })
    .eq("id", id)

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateDomainPaths()
  return { ok: true }
}

export async function setRuleDomainStatusAction(input: {
  id: string
  status: "active" | "retired"
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const id = input.id.trim()
  if (!id) return { ok: false, error: "領域が指定されていません。" }

  const { error } = await op.service
    .from("rule_domains")
    .update({ status: input.status })
    .eq("id", id)

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateDomainPaths()
  return { ok: true }
}

export async function deleteRuleDomainAction(input: {
  id: string
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const id = input.id.trim()
  if (!id) return { ok: false, error: "領域が指定されていません。" }

  const { data: domain, error: fetchError } = await op.service
    .from("rule_domains")
    .select("id, is_system")
    .eq("id", id)
    .maybeSingle()
  if (fetchError) return { ok: false, error: toUserErrorMessage(fetchError) }
  if (!domain) return { ok: false, error: "領域が見つかりません。" }

  const { count, error: countError } = await op.service
    .from("ai_check_rules")
    .select("id", { count: "exact", head: true })
    .eq("domain_id", id)
  if (countError) return { ok: false, error: toUserErrorMessage(countError) }

  const allowed = canDeleteDomain({
    isSystem: Boolean(domain.is_system),
    linkedRuleCount: count ?? 0,
  })
  if (!allowed.ok) return { ok: false, error: allowed.error }

  const { error } = await op.service.from("rule_domains").delete().eq("id", id)
  if (error) return { ok: false, error: toUserErrorMessage(error) }
  revalidateDomainPaths()
  return { ok: true }
}
