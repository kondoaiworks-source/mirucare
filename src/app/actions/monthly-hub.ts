"use server"

import { createClient } from "@/lib/supabase/server"
import {
  detectAttendanceContradictions,
  type AttendanceWithHelper,
  type ServiceRecordWithHelper,
} from "@/lib/attendance/detect-contradictions"
import type { AttendanceContradiction, ServiceRecord } from "@/types/database"
import type { MonthlyCoreDocId } from "@/lib/copy/product-charter"

export type ActionResult<T> = {
  ok: boolean
  error?: string
  data?: T
}

export type CoverageStatus = "ready" | "partial" | "missing" | "manual"

export type MonthlyDocCoverage = {
  id: MonthlyCoreDocId
  status: CoverageStatus
  count: number
  detail: string
  href: string
  cta: string
}

export type MonthlyHubData = {
  yearMonth: string
  fromDate: string
  toDate: string
  coverage: MonthlyDocCoverage[]
  readyCount: number
  totalTracked: number
  contradictions: AttendanceContradiction[]
  contradictionTruncated: boolean
}

type HelperJoin = { display_name: string } | { display_name: string }[] | null

function helperNameFromJoin(helpers: HelperJoin): string {
  if (!helpers) return "（氏名なし）"
  if (Array.isArray(helpers)) {
    return helpers[0]?.display_name?.trim() || "（氏名なし）"
  }
  return helpers.display_name?.trim() || "（氏名なし）"
}

function monthRange(yearMonth: string): {
  fromDate: string
  toDate: string
  nextMonthStart: string
} {
  const [y, m] = yearMonth.split("-").map((n) => Number(n))
  const fromDate = `${yearMonth}-01`
  const nextMonthStart =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const toDate = `${yearMonth}-${String(lastDay).padStart(2, "0")}`
  return { fromDate, toDate, nextMonthStart }
}

function currentYearMonth(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
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
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return {
      error:
        "事業所情報を取得できませんでした。オンボーディングが完了しているかご確認ください。",
    } as const
  }

  return {
    supabase,
    organizationId: profile.organization_id as string,
  } as const
}

/**
 * 月末確認ハブ用：4大書類の投入状況＋勤怠矛盾候補（当月）
 */
export async function getMonthlyHubDataAction(input?: {
  yearMonth?: string
  contradictionLimit?: number
}): Promise<ActionResult<MonthlyHubData>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) {
    return { ok: false, error: ctx.error }
  }

  const yearMonth =
    input?.yearMonth && /^\d{4}-\d{2}$/.test(input.yearMonth)
      ? input.yearMonth
      : currentYearMonth()
  const limit = Math.min(Math.max(input?.contradictionLimit ?? 8, 1), 30)
  const { fromDate, toDate, nextMonthStart } = monthRange(yearMonth)
  const { supabase, organizationId } = ctx

  const [
    carePlanRes,
    serviceCountRes,
    attendanceCountRes,
    recordRowsRes,
    attendanceRowsRes,
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("doc_type", "ケアプラン")
      .is("deleted_at", null)
      .gte("created_at", `${fromDate}T00:00:00.000Z`)
      .lt("created_at", `${nextMonthStart}T00:00:00.000Z`),
    supabase
      .from("service_records")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("service_date", fromDate)
      .lt("service_date", nextMonthStart),
    supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("work_date", fromDate)
      .lt("work_date", nextMonthStart),
    supabase
      .from("service_records")
      .select(
        "id, organization_id, helper_id, client_label, service_date, start_at, end_at, created_at, updated_at, deleted_at, helpers(display_name)"
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("service_date", fromDate)
      .lt("service_date", nextMonthStart)
      .order("service_date", { ascending: true }),
    supabase
      .from("attendance")
      .select(
        "id, organization_id, helper_id, work_date, clock_in_at, clock_out_at, created_at, updated_at, deleted_at, helpers(display_name)"
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("work_date", fromDate)
      .lt("work_date", nextMonthStart),
  ])

  const carePlanCount = carePlanRes.count ?? 0
  const serviceCount = serviceCountRes.count ?? 0
  const attendanceCount = attendanceCountRes.count ?? 0

  const coverage: MonthlyDocCoverage[] = [
    {
      id: "care_plan",
      status: carePlanCount > 0 ? "ready" : "missing",
      count: carePlanCount,
      detail:
        carePlanCount > 0
          ? `今月のアップロード ${carePlanCount}件`
          : "今月は未投入です（日次チェックからアップロード）",
      href: "/check/upload",
      cta: carePlanCount > 0 ? "追加でチェックする" : "ケアプランをチェックする",
    },
    {
      id: "service_records",
      status: serviceCount > 0 ? "ready" : "missing",
      count: serviceCount,
      detail:
        serviceCount > 0
          ? `取込済み ${serviceCount}件`
          : "未投入です。日報CSVを取り込んでください",
      href: "/attendance/import?kind=service_records",
      cta: serviceCount > 0 ? "日報を追加取込する" : "日報CSVを取り込む",
    },
    {
      id: "attendance",
      status: attendanceCount > 0 ? "ready" : "missing",
      count: attendanceCount,
      detail:
        attendanceCount > 0
          ? `取込済み ${attendanceCount}件`
          : "未投入です。勤怠CSVを取り込んでください",
      href: "/attendance/import?kind=attendance",
      cta: attendanceCount > 0 ? "勤怠を追加取込する" : "勤怠CSVを取り込む",
    },
    {
      id: "billing",
      status: "manual",
      count: 0,
      detail:
        "請求CSVはサーバーに保存しません。照合画面で端末内処理してください",
      href: "/billing-reconcile",
      cta: "請求CSVを照合する",
    },
  ]

  type RecordRow = ServiceRecord & { helpers: HelperJoin }
  type AttendanceRow = {
    id: string
    organization_id: string
    helper_id: string
    work_date: string
    clock_in_at: string
    clock_out_at: string
    created_at: string
    updated_at: string
    deleted_at: string | null
    helpers: HelperJoin
  }

  let contradictions: AttendanceContradiction[] = []
  if (!recordRowsRes.error && !attendanceRowsRes.error) {
    const records: ServiceRecordWithHelper[] = (
      (recordRowsRes.data ?? []) as RecordRow[]
    ).map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      helper_id: row.helper_id,
      client_label: row.client_label,
      service_date: row.service_date,
      start_at: row.start_at,
      end_at: row.end_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      helper_name: helperNameFromJoin(row.helpers),
    }))

    const attendances: AttendanceWithHelper[] = (
      (attendanceRowsRes.data ?? []) as AttendanceRow[]
    ).map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      helper_id: row.helper_id,
      work_date: row.work_date,
      clock_in_at: row.clock_in_at,
      clock_out_at: row.clock_out_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      helper_name: helperNameFromJoin(row.helpers),
    }))

    contradictions = detectAttendanceContradictions(records, attendances)
  }

  const contradictionTruncated = contradictions.length > limit
  // billing は manual なので「追跡可能な投入」は3種
  const totalTracked = 3
  const trackedReady = coverage.filter((c) => c.status === "ready").length

  return {
    ok: true,
    data: {
      yearMonth,
      fromDate,
      toDate,
      coverage,
      readyCount: trackedReady,
      totalTracked,
      contradictions: contradictions.slice(0, limit),
      contradictionTruncated,
    },
  }
}
