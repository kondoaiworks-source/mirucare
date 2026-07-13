"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  toTokyoIso,
  type AttendanceImportKind,
  type ParsedAttendanceRow,
  type ParsedHelperRow,
  type ParsedServiceRecordRow,
  type ParsedShiftRow,
} from "@/lib/attendance/csv-parse"

export type ActionResult<T> = {
  ok: boolean
  error?: string
  data?: T
}

export type ImportCommitPayload =
  | { kind: "helpers"; rows: ParsedHelperRow[] }
  | { kind: "attendance"; rows: ParsedAttendanceRow[] }
  | { kind: "service_records"; rows: ParsedServiceRecordRow[] }
  | { kind: "shifts"; rows: ParsedShiftRow[] }

export type ImportCommitResult = {
  kind: AttendanceImportKind
  inserted: number
  updated: number
  skipped: number
  unresolvedHelpers: number
}

type HelperRow = {
  id: string
  display_name: string
  employee_code: string | null
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

function normalizeNameKey(name: string): string {
  return name.trim().replace(/\s+/g, "").replace(/　/g, "")
}

async function loadHelpers(
  supabase: ReturnType<typeof createClient>,
  organizationId: string
): Promise<HelperRow[]> {
  const { data, error } = await supabase
    .from("helpers")
    .select("id, display_name, employee_code")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  if (error) return []
  return (data ?? []) as HelperRow[]
}

function findHelperId(
  helpers: HelperRow[],
  employeeCode: string | null,
  helperName: string
): string | null {
  const code = employeeCode?.trim()
  if (code) {
    const byCode = helpers.find((h) => h.employee_code?.trim() === code)
    if (byCode) return byCode.id
  }
  const key = normalizeNameKey(helperName)
  if (!key) return null
  const byName = helpers.find(
    (h) => normalizeNameKey(h.display_name) === key
  )
  return byName?.id ?? null
}

async function ensureHelper(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  helpers: HelperRow[],
  employeeCode: string | null,
  helperName: string
): Promise<{ id: string; created: boolean } | null> {
  const existing = findHelperId(helpers, employeeCode, helperName)
  if (existing) return { id: existing, created: false }

  const displayName = helperName.trim() || employeeCode?.trim() || ""
  if (!displayName) return null

  const { data, error } = await supabase
    .from("helpers")
    .insert({
      organization_id: organizationId,
      display_name: displayName,
      employee_code: employeeCode?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .select("id, display_name, employee_code")
    .single()

  if (error || !data) return null

  const row = data as HelperRow
  helpers.push(row)
  return { id: row.id, created: true }
}

/**
 * 介護ソフトCSVからパースした構造化データを取り込み（生CSVは受け取らない）
 */
export async function commitAttendanceImportAction(
  payload: ImportCommitPayload
): Promise<ActionResult<ImportCommitResult>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) {
    return { ok: false, error: ctx.error }
  }

  const { supabase, organizationId } = ctx

  if (!payload.rows.length) {
    return {
      ok: false,
      error: "取り込む行がありません。CSVの内容をご確認ください。",
    }
  }

  if (payload.rows.length > 5000) {
    return {
      ok: false,
      error: "一度に取り込めるのは5,000行までです。分割して取り込んでください。",
    }
  }

  const helpers = await loadHelpers(supabase, organizationId)
  let inserted = 0
  let updated = 0
  let skipped = 0
  let unresolvedHelpers = 0

  if (payload.kind === "helpers") {
    for (const row of payload.rows) {
      const existing = findHelperId(
        helpers,
        row.employeeCode,
        row.displayName
      )
      if (existing) {
        const { error } = await supabase
          .from("helpers")
          .update({
            display_name: row.displayName.trim(),
            employee_code: row.employeeCode?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing)
          .eq("organization_id", organizationId)
        if (error) {
          skipped += 1
        } else {
          updated += 1
          const h = helpers.find((x) => x.id === existing)
          if (h) {
            h.display_name = row.displayName.trim()
            h.employee_code = row.employeeCode?.trim() || null
          }
        }
        continue
      }

      const created = await ensureHelper(
        supabase,
        organizationId,
        helpers,
        row.employeeCode,
        row.displayName
      )
      if (created?.created) inserted += 1
      else skipped += 1
    }
  } else if (payload.kind === "attendance") {
    for (const row of payload.rows) {
      const helper = await ensureHelper(
        supabase,
        organizationId,
        helpers,
        row.employeeCode,
        row.helperName
      )
      if (!helper) {
        unresolvedHelpers += 1
        skipped += 1
        continue
      }

      const clockIn = toTokyoIso(row.workDate, row.clockInHm)
      const clockOut = toTokyoIso(row.workDate, row.clockOutHm)

      const { data: existing } = await supabase
        .from("attendance")
        .select("id")
        .eq("helper_id", helper.id)
        .eq("work_date", row.workDate)
        .is("deleted_at", null)
        .maybeSingle()

      if (existing?.id) {
        const { error } = await supabase
          .from("attendance")
          .update({
            clock_in_at: clockIn,
            clock_out_at: clockOut,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("organization_id", organizationId)
        if (error) skipped += 1
        else updated += 1
      } else {
        const { error } = await supabase.from("attendance").insert({
          organization_id: organizationId,
          helper_id: helper.id,
          work_date: row.workDate,
          clock_in_at: clockIn,
          clock_out_at: clockOut,
        })
        if (error) skipped += 1
        else inserted += 1
      }
    }
  } else if (payload.kind === "service_records") {
    for (const row of payload.rows) {
      const helper = await ensureHelper(
        supabase,
        organizationId,
        helpers,
        row.employeeCode,
        row.helperName
      )
      if (!helper) {
        unresolvedHelpers += 1
        skipped += 1
        continue
      }

      const startAt = toTokyoIso(row.serviceDate, row.startHm)
      const endAt = toTokyoIso(row.serviceDate, row.endHm)

      const { data: existing } = await supabase
        .from("service_records")
        .select("id")
        .eq("helper_id", helper.id)
        .eq("service_date", row.serviceDate)
        .eq("start_at", startAt)
        .eq("end_at", endAt)
        .eq("client_label", row.clientLabel.trim())
        .is("deleted_at", null)
        .maybeSingle()

      if (existing?.id) {
        skipped += 1
        continue
      }

      const { error } = await supabase.from("service_records").insert({
        organization_id: organizationId,
        helper_id: helper.id,
        client_label: row.clientLabel.trim(),
        service_date: row.serviceDate,
        start_at: startAt,
        end_at: endAt,
      })
      if (error) skipped += 1
      else inserted += 1
    }
  } else {
    for (const row of payload.rows) {
      const helper = await ensureHelper(
        supabase,
        organizationId,
        helpers,
        row.employeeCode,
        row.helperName
      )
      if (!helper) {
        unresolvedHelpers += 1
        skipped += 1
        continue
      }

      const startAt = toTokyoIso(row.workDate, row.startHm)
      const endAt = toTokyoIso(row.workDate, row.endHm)

      const { data: existing } = await supabase
        .from("shifts")
        .select("id")
        .eq("helper_id", helper.id)
        .eq("work_date", row.workDate)
        .eq("start_at", startAt)
        .eq("end_at", endAt)
        .is("deleted_at", null)
        .maybeSingle()

      if (existing?.id) {
        const { error } = await supabase
          .from("shifts")
          .update({
            note: row.note,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("organization_id", organizationId)
        if (error) skipped += 1
        else updated += 1
        continue
      }

      const { error } = await supabase.from("shifts").insert({
        organization_id: organizationId,
        helper_id: helper.id,
        work_date: row.workDate,
        start_at: startAt,
        end_at: endAt,
        note: row.note,
      })
      if (error) skipped += 1
      else inserted += 1
    }
  }

  revalidatePath("/attendance")
  revalidatePath("/attendance/import")
  revalidatePath("/billing-reconcile")
  revalidatePath("/reconcile")

  return {
    ok: true,
    data: {
      kind: payload.kind,
      inserted,
      updated,
      skipped,
      unresolvedHelpers,
    },
  }
}
