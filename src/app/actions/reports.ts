"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { toUserErrorMessage } from "@/lib/auth-errors"
import {
  dateToMonthKey,
  monthKeyToDate,
  SEVERITY_BREAKDOWN_LABELS,
  type SeverityBreakdownItem,
} from "@/lib/reports"
import { canUseReports } from "@/lib/plans"
import type {
  FindingSeverity,
  PlanType,
  Report,
} from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

export type MonthlyReportView = {
  plan: PlanType
  isPremium: boolean
  monthKey: string
  report: Report | null
  breakdown: SeverityBreakdownItem[]
}

async function requireOrgContext() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error:
        "ログインの有効期限が切れた可能性があります。再度ログインしてください。",
    } as const
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role, organizations(plan)")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return {
      error:
        "事業所情報を取得できませんでした。オンボーディングが完了しているかご確認ください。",
    } as const
  }

  const org = Array.isArray(profile.organizations)
    ? profile.organizations[0]
    : profile.organizations

  return {
    supabase,
    user,
    organizationId: profile.organization_id as string,
    role: profile.role as string,
    plan: (org?.plan ?? "none") as PlanType,
  } as const
}

function isValidMonthKey(monthKey: string): boolean {
  return /^\d{4}-\d{2}$/.test(monthKey)
}

async function fetchSeverityBreakdown(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  monthKey: string
): Promise<SeverityBreakdownItem[]> {
  const start = monthKeyToDate(monthKey)
  const [y, m] = monthKey.split("-").map(Number)
  const endDate = new Date(y, m, 1) // next month 1st
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`

  const { data, error } = await supabase
    .from("findings")
    .select("severity")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .gte("created_at", start)
    .lt("created_at", end)

  if (error || !data) return []

  const counts: Record<FindingSeverity, number> = {
    high: 0,
    mid: 0,
    low: 0,
  }
  for (const row of data) {
    const s = row.severity as FindingSeverity
    if (s in counts) counts[s] += 1
  }

  return (Object.keys(counts) as FindingSeverity[])
    .map((key) => ({
      key,
      label: SEVERITY_BREAKDOWN_LABELS[key],
      count: counts[key],
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
}

/** 月次レポート画面用データ（プランに応じて本文はマスク） */
export async function getMonthlyReportAction(
  monthKey: string
): Promise<ActionResult<MonthlyReportView>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  if (!isValidMonthKey(monthKey)) {
    return { ok: false, error: "対象月の形式が正しくありません。" }
  }

  const isPremium = canUseReports(ctx.plan)
  const monthDate = monthKeyToDate(monthKey)

  const { data: report, error } = await ctx.supabase
    .from("reports")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .eq("month", monthDate)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      error:
        error.message.includes("does not exist") ||
        error.code === "42P01" ||
        error.code === "PGRST205"
          ? "レポートテーブルが見つかりません。Supabase SQL Editor で supabase/migrations/20260711050000_reports.sql を実行してください。"
          : toUserErrorMessage(error),
    }
  }

  const breakdown = isPremium
    ? await fetchSeverityBreakdown(
        ctx.supabase,
        ctx.organizationId,
        monthKey
      )
    : []

  return {
    ok: true,
    data: {
      plan: ctx.plan,
      isPremium,
      monthKey,
      report: isPremium ? ((report as Report | null) ?? null) : null,
      breakdown,
    },
  }
}

export async function listReportsAdminAction(): Promise<
  ActionResult<{ reports: Report[]; plan: PlanType }>
> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  if (ctx.role !== "admin") {
    return {
      ok: false,
      error: "レポート管理は管理者のみ利用できます。",
    }
  }

  const { data, error } = await ctx.supabase
    .from("reports")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .order("month", { ascending: false })

  if (error) {
    return {
      ok: false,
      error:
        error.message.includes("does not exist") ||
        error.code === "42P01" ||
        error.code === "PGRST205"
          ? "レポートテーブルが見つかりません。Supabase SQL Editor で supabase/migrations/20260711050000_reports.sql を実行してください。"
          : toUserErrorMessage(error),
    }
  }

  return {
    ok: true,
    data: {
      reports: (data as Report[]) ?? [],
      plan: ctx.plan,
    },
  }
}

/** 対象月の指摘件数から risk / fixed の初期値を算出 */
export async function suggestReportCountsAction(
  monthKey: string
): Promise<ActionResult<{ riskCount: number; fixedCount: number }>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }
  if (ctx.role !== "admin") {
    return { ok: false, error: "管理者のみ利用できます。" }
  }
  if (!isValidMonthKey(monthKey)) {
    return { ok: false, error: "対象月の形式が正しくありません。" }
  }

  const start = monthKeyToDate(monthKey)
  const [y, m] = monthKey.split("-").map(Number)
  const endDate = new Date(y, m, 1)
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`

  const { data, error } = await ctx.supabase
    .from("findings")
    .select("severity, status")
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .gte("created_at", start)
    .lt("created_at", end)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  const rows = data ?? []
  const riskCount = rows.filter((r) => r.severity === "high").length
  const fixedCount = rows.filter((r) => r.status === "fixed").length

  return { ok: true, data: { riskCount, fixedCount } }
}

export async function upsertReportAction(input: {
  monthKey: string
  summaryMd: string
  riskCount: number
  fixedCount: number
}): Promise<ActionResult<{ report: Report }>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  if (ctx.role !== "admin") {
    return {
      ok: false,
      error: "レポートの作成・更新は管理者のみ行えます。",
    }
  }

  if (!isValidMonthKey(input.monthKey)) {
    return { ok: false, error: "対象月の形式が正しくありません。" }
  }

  const summaryMd = input.summaryMd.trim()
  if (!summaryMd) {
    return {
      ok: false,
      error: "原因分析の本文を入力してください。",
    }
  }

  if (
    !Number.isFinite(input.riskCount) ||
    input.riskCount < 0 ||
    !Number.isInteger(input.riskCount)
  ) {
    return { ok: false, error: "返還リスク件数は0以上の整数で入力してください。" }
  }
  if (
    !Number.isFinite(input.fixedCount) ||
    input.fixedCount < 0 ||
    !Number.isInteger(input.fixedCount)
  ) {
    return { ok: false, error: "対応済み件数は0以上の整数で入力してください。" }
  }

  const monthDate = monthKeyToDate(input.monthKey)
  const now = new Date().toISOString()

  const { data: existing } = await ctx.supabase
    .from("reports")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("month", monthDate)
    .is("deleted_at", null)
    .maybeSingle()

  let report: Report | null = null

  if (existing?.id) {
    const { data, error } = await ctx.supabase
      .from("reports")
      .update({
        summary_md: summaryMd,
        risk_count: input.riskCount,
        fixed_count: input.fixedCount,
        updated_at: now,
      })
      .eq("id", existing.id)
      .eq("organization_id", ctx.organizationId)
      .select("*")
      .single()

    if (error) return { ok: false, error: toUserErrorMessage(error) }
    report = data as Report
  } else {
    const { data, error } = await ctx.supabase
      .from("reports")
      .insert({
        organization_id: ctx.organizationId,
        month: monthDate,
        summary_md: summaryMd,
        risk_count: input.riskCount,
        fixed_count: input.fixedCount,
      })
      .select("*")
      .single()

    if (error) return { ok: false, error: toUserErrorMessage(error) }
    report = data as Report
  }

  revalidatePath("/reports")
  revalidatePath("/admin/reports")

  return { ok: true, data: { report: report! } }
}

export async function softDeleteReportAction(
  reportId: string
): Promise<ActionResult> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  if (ctx.role !== "admin") {
    return { ok: false, error: "削除は管理者のみ行えます。" }
  }

  const { error } = await ctx.supabase
    .from("reports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("organization_id", ctx.organizationId)

  if (error) return { ok: false, error: toUserErrorMessage(error) }

  revalidatePath("/reports")
  revalidatePath("/admin/reports")
  return { ok: true }
}

/** 管理画面の編集用：既存レポート1件 */
export async function getReportByMonthAdminAction(
  monthKey: string
): Promise<ActionResult<{ report: Report | null }>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }
  if (ctx.role !== "admin") {
    return { ok: false, error: "管理者のみ利用できます。" }
  }
  if (!isValidMonthKey(monthKey)) {
    return { ok: false, error: "対象月の形式が正しくありません。" }
  }

  const { data, error } = await ctx.supabase
    .from("reports")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .eq("month", monthKeyToDate(monthKey))
    .is("deleted_at", null)
    .maybeSingle()

  if (error) return { ok: false, error: toUserErrorMessage(error) }
  return { ok: true, data: { report: (data as Report | null) ?? null } }
}

export { dateToMonthKey }
