"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { toUserErrorMessage } from "@/lib/auth-errors"
import {
  computeDeadlineStatus,
  daysUntilDue,
  filterByTab,
  refreshDeadlineStatuses,
  toDateOnly,
  type DeadlineTab,
} from "@/lib/deadline-status"
import { toPrivacySubject } from "@/lib/deadlines"
import { canUseAlerts } from "@/lib/plans"
import type {
  Deadline,
  DeadlineKind,
  DeadlineStatus,
  DocumentStatus,
  Finding,
  PlanType,
  AppAnnouncement,
} from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
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
    plan: (org?.plan ?? "none") as PlanType,
  } as const
}

async function syncStoredStatuses(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  items: Deadline[]
) {
  const today = toDateOnly()
  for (const item of items) {
    if (item.status === "done") continue
    const next = computeDeadlineStatus(item.due_date, item.status, today)
    if (next !== item.status) {
      await supabase
        .from("deadlines")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("organization_id", organizationId)
      item.status = next
    }
  }
}

export async function listDeadlinesAction(): Promise<
  ActionResult<{ deadlines: Deadline[]; alertsEnabled: boolean; plan: PlanType }>
> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const alertsEnabled = canUseAlerts(ctx.plan)
  if (!alertsEnabled) {
    return {
      ok: true,
      data: { deadlines: [], alertsEnabled: false, plan: ctx.plan },
    }
  }

  const { data, error } = await ctx.supabase
    .from("deadlines")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  const deadlines = (data ?? []) as Deadline[]
  await syncStoredStatuses(ctx.supabase, ctx.organizationId, deadlines)

  return {
    ok: true,
    data: { deadlines, alertsEnabled: true, plan: ctx.plan },
  }
}

export async function listDeadlinesByTabAction(
  tab: DeadlineTab
): Promise<ActionResult<{ deadlines: Deadline[] }>> {
  const listed = await listDeadlinesAction()
  if (!listed.ok || !listed.data) return listed
  return {
    ok: true,
    data: { deadlines: filterByTab(listed.data.deadlines, tab) },
  }
}

export async function createDeadlineAction(input: {
  subject: string
  kind: DeadlineKind
  dueDate: string
}): Promise<ActionResult<{ deadline: Deadline }>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  if (!canUseAlerts(ctx.plan)) {
    return {
      ok: false,
      error:
        "期限アラートの追加はスタンダード以上のプランでご利用いただけます。",
    }
  }

  const subject = toPrivacySubject(input.subject.trim())
  if (!subject || subject.length < 2) {
    return { ok: false, error: "対象を入力してください（例：山田様 ケアプラン）。" }
  }
  if (!input.dueDate) {
    return { ok: false, error: "期限日を選択してください。" }
  }

  const status = computeDeadlineStatus(input.dueDate, "ok")

  const { data, error } = await ctx.supabase
    .from("deadlines")
    .insert({
      organization_id: ctx.organizationId,
      subject,
      kind: input.kind,
      due_date: input.dueDate,
      status,
      created_by: ctx.user.id,
    })
    .select("*")
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: toUserErrorMessage(error, "期限の追加に失敗しました。"),
    }
  }

  revalidatePath("/")
  revalidatePath("/alerts")
  return { ok: true, data: { deadline: data as Deadline } }
}

export async function markDeadlineDoneAction(
  deadlineId: string
): Promise<ActionResult> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { error } = await ctx.supabase
    .from("deadlines")
    .update({
      status: "done" satisfies DeadlineStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deadlineId)
    .eq("organization_id", ctx.organizationId)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidatePath("/")
  revalidatePath("/alerts")
  return { ok: true }
}

export type DashboardIncompleteDocument = {
  id: string
  original_name: string
  doc_type: string
  status: DocumentStatus
  created_at: string
}

export type DashboardData = {
  /** 未完了の書類チェック（今日やることの先頭） */
  incompleteDocuments: DashboardIncompleteDocument[]
  /** まもなく／超過の期限アラート（書類とは別） */
  upcomingDeadlines: Array<Deadline & { daysLeft: number }>
  /** @deprecated upcomingDeadlines を使う */
  todayTodos: Array<Deadline & { daysLeft: number }>
  weekly: {
    uploads: number
    findings: number
    fixed: number
  }
  recentFindings: Array<
    Finding & {
      documents: { id: string; original_name: string; doc_type: string } | null
    }
  >
  /** アプリ内お知らせ（最新3件） */
  announcements: AppAnnouncement[]
}

export async function getDashboardDataAction(): Promise<
  ActionResult<DashboardData>
> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const today = toDateOnly()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoIso = weekAgo.toISOString()

  const [
    deadlinesRes,
    incompleteDocsRes,
    docsRes,
    findingsRes,
    fixedRes,
    recentRes,
    announcementsRes,
  ] = await Promise.all([
    ctx.supabase
      .from("deadlines")
      .select("*")
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .neq("status", "done")
      .order("due_date", { ascending: true })
      .limit(20),
    ctx.supabase
      .from("documents")
      .select("id, original_name, doc_type, status, created_at")
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(3),
    ctx.supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .gte("created_at", weekAgoIso),
    ctx.supabase
      .from("findings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .eq("review_status", "approved")
      .is("deleted_at", null)
      .gte("created_at", weekAgoIso),
    ctx.supabase
      .from("findings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .eq("review_status", "approved")
      .eq("status", "fixed")
      .is("deleted_at", null)
      .gte("updated_at", weekAgoIso),
    ctx.supabase
      .from("findings")
      .select(
        `
          *,
          documents (
            id,
            original_name,
            doc_type
          )
        `
      )
      .eq("organization_id", ctx.organizationId)
      .eq("review_status", "approved")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    ctx.supabase
      .from("app_announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3),
  ])

  const deadlines = refreshDeadlineStatuses(
    (deadlinesRes.data ?? []) as Deadline[]
  )
  await syncStoredStatuses(ctx.supabase, ctx.organizationId, [
    ...((deadlinesRes.data ?? []) as Deadline[]),
  ])

  const upcomingDeadlines = deadlines
    .filter((d) => d.status !== "done")
    .map((d) => ({ ...d, daysLeft: daysUntilDue(d.due_date, today) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3)

  const incompleteDocuments = (
    (incompleteDocsRes.data ?? []) as DashboardIncompleteDocument[]
  ).filter((d) => d.status !== "done")

  return {
    ok: true,
    data: {
      incompleteDocuments,
      upcomingDeadlines,
      todayTodos: upcomingDeadlines,
      weekly: {
        uploads: docsRes.count ?? 0,
        findings: findingsRes.count ?? 0,
        fixed: fixedRes.count ?? 0,
      },
      recentFindings: (recentRes.data ?? []) as DashboardData["recentFindings"],
      announcements: announcementsRes.error
        ? []
        : ((announcementsRes.data ?? []) as AppAnnouncement[]),
    },
  }
}
