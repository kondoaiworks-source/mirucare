"use server"

import { createClient } from "@/lib/supabase/server"
import {
  detectAttendanceContradictions,
  type AttendanceWithHelper,
  type ServiceRecordWithHelper,
} from "@/lib/attendance/detect-contradictions"
import type {
  AttendanceContradiction,
  ServiceRecord,
} from "@/types/database"
import type { ServiceRecordForReconcile } from "@/lib/billing/reconcile"

export type ActionResult<T> = {
  ok: boolean
  error?: string
  data?: T
}

type HelperJoin = { display_name: string } | { display_name: string }[] | null

function helperNameFromJoin(helpers: HelperJoin): string {
  if (!helpers) return "（氏名なし）"
  if (Array.isArray(helpers)) {
    return helpers[0]?.display_name?.trim() || "（氏名なし）"
  }
  return helpers.display_name?.trim() || "（氏名なし）"
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
 * シフト・タイムカード・日報を突き合わせ、矛盾を返す
 * （請求CSVは扱わない）
 */
export async function detectAttendanceContradictionsAction(input?: {
  fromDate?: string
  toDate?: string
}): Promise<ActionResult<AttendanceContradiction[]>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) {
    return { ok: false, error: ctx.error }
  }

  const { supabase, organizationId } = ctx
  const fromDate = input?.fromDate
  const toDate = input?.toDate

  let recordsQuery = supabase
    .from("service_records")
    .select(
      "id, organization_id, helper_id, client_label, service_date, start_at, end_at, created_at, updated_at, deleted_at, helpers(display_name)"
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("service_date", { ascending: true })

  if (fromDate) recordsQuery = recordsQuery.gte("service_date", fromDate)
  if (toDate) recordsQuery = recordsQuery.lte("service_date", toDate)

  const { data: recordRows, error: recordsError } = await recordsQuery

  if (recordsError) {
    return {
      ok: false,
      error:
        "日報データの取得に失敗しました。マイグレーション（勤怠・日報）が適用されているかご確認ください。",
    }
  }

  let attendanceQuery = supabase
    .from("attendance")
    .select(
      "id, organization_id, helper_id, work_date, clock_in_at, clock_out_at, created_at, updated_at, deleted_at, helpers(display_name)"
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  if (fromDate) attendanceQuery = attendanceQuery.gte("work_date", fromDate)
  if (toDate) attendanceQuery = attendanceQuery.lte("work_date", toDate)

  const { data: attendanceRows, error: attendanceError } =
    await attendanceQuery

  if (attendanceError) {
    return {
      ok: false,
      error:
        "タイムカードデータの取得に失敗しました。マイグレーションが適用されているかご確認ください。",
    }
  }

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

  const records: ServiceRecordWithHelper[] = (
    (recordRows ?? []) as RecordRow[]
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
    (attendanceRows ?? []) as AttendanceRow[]
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

  const contradictions = detectAttendanceContradictions(records, attendances)
  return { ok: true, data: contradictions }
}

/**
 * 該当月の日報のみ返す（請求CSVは受け取らない・保存しない）
 */
export async function listServiceRecordsForMonthAction(
  yearMonth: string
): Promise<ActionResult<ServiceRecordForReconcile[]>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) {
    return { ok: false, error: ctx.error }
  }

  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    return {
      ok: false,
      error: "対象月の形式が正しくありません（例: 2026-07）。",
    }
  }

  const { supabase, organizationId } = ctx
  const fromDate = `${yearMonth}-01`
  const [y, m] = yearMonth.split("-").map((n) => Number(n))
  const nextMonth =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`

  const { data, error } = await supabase
    .from("service_records")
    .select("id, client_label, service_date, start_at, end_at")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .gte("service_date", fromDate)
    .lt("service_date", nextMonth)
    .order("service_date", { ascending: true })

  if (error) {
    return {
      ok: false,
      error:
        "日報データの取得に失敗しました。マイグレーションが適用されているかご確認ください。",
    }
  }

  const rows: ServiceRecordForReconcile[] = (data ?? []).map((row) => ({
    id: row.id as string,
    client_label: row.client_label as string,
    service_date: row.service_date as string,
    start_at: row.start_at as string,
    end_at: row.end_at as string,
  }))

  return { ok: true, data: rows }
}
