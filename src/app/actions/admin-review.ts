"use server"

import { revalidatePath } from "next/cache"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import type {
  FeedbackInboxItem,
  ReviewMetrics,
  ReviewQueueItem,
} from "@/lib/admin-review"
import type { DocType, FindingSeverity } from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

type FindingRow = {
  id: string
  document_id: string
  organization_id: string
  severity: FindingSeverity
  title: string
  description: string
  basis: string | null
  suggestion: string | null
  review_status: string
  created_at: string
  organizations:
    | { name: string; municipality: string | null }
    | { name: string; municipality: string | null }[]
    | null
  documents: { doc_type: DocType } | { doc_type: DocType }[] | null
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapQueueItem(row: FindingRow): ReviewQueueItem {
  const org = unwrapOne(row.organizations)
  const doc = unwrapOne(row.documents)
  return {
    id: row.id,
    document_id: row.document_id,
    organization_id: row.organization_id,
    severity: row.severity,
    title: row.title,
    description: row.description,
    basis: row.basis,
    suggestion: row.suggestion,
    review_status: row.review_status as ReviewQueueItem["review_status"],
    created_at: row.created_at,
    organization_name: org?.name ?? "（不明）",
    municipality: org?.municipality ?? null,
    doc_type: doc?.doc_type ?? "その他",
  }
}

export async function getReviewConsoleDataAction(): Promise<
  ActionResult<{
    queue: ReviewQueueItem[]
    metrics: ReviewMetrics
    feedback: FeedbackInboxItem[]
  }>
> {
  const ctx = await requireOperator()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { data: rows, error } = await ctx.service
    .from("findings")
    .select(
      `
      id,
      document_id,
      organization_id,
      severity,
      title,
      description,
      basis,
      suggestion,
      review_status,
      created_at,
      organizations ( name, municipality ),
      documents ( doc_type )
    `
    )
    .eq("review_status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200)

  if (error) {
    return {
      ok: false,
      error:
        error.message.includes("does not exist") ||
        error.code === "42P01" ||
        error.code === "PGRST205"
          ? "レビュー用テーブルが見つかりません。Supabase SQL Editor で supabase/migrations/20260711060000_admin_review.sql を実行してください。"
          : toUserErrorMessage(error),
    }
  }

  const queue = ((rows ?? []) as unknown as FindingRow[]).map(mapQueueItem)

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [{ count: pendingCount }, { data: todayLogs }, { data: recentLogs }] =
    await Promise.all([
      ctx.service
        .from("findings")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "pending")
        .is("deleted_at", null),
      ctx.service
        .from("finding_review_logs")
        .select("id")
        .gte("created_at", startOfDay.toISOString()),
      ctx.service
        .from("finding_review_logs")
        .select("duration_ms")
        .order("created_at", { ascending: false })
        .limit(100),
    ])

  const durations = (recentLogs ?? [])
    .map((r) => r.duration_ms as number)
    .filter((n) => Number.isFinite(n) && n >= 0)

  const avgDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null

  const metrics: ReviewMetrics = {
    pendingCount: pendingCount ?? queue.length,
    reviewedToday: todayLogs?.length ?? 0,
    avgDurationMs,
    sampleCount: durations.length,
  }

  const { data: feedbackRows, error: fbError } = await ctx.service
    .from("finding_feedback")
    .select(
      `
      id,
      finding_id,
      document_id,
      organization_id,
      reason,
      operator_note,
      created_at,
      organizations ( name ),
      findings ( title ),
      documents ( doc_type )
    `
    )
    .order("created_at", { ascending: false })
    .limit(50)

  if (fbError) {
    return { ok: false, error: toUserErrorMessage(fbError) }
  }

  type FbRow = {
    id: string
    finding_id: string
    document_id: string
    organization_id: string
    reason: string | null
    operator_note: string | null
    created_at: string
    organizations: { name: string } | { name: string }[] | null
    findings: { title: string } | { title: string }[] | null
    documents: { doc_type: DocType } | { doc_type: DocType }[] | null
  }

  const feedback: FeedbackInboxItem[] = ((feedbackRows ?? []) as unknown as FbRow[]).map(
    (r) => {
      const org = unwrapOne(r.organizations)
      const finding = unwrapOne(r.findings)
      const doc = unwrapOne(r.documents)
      return {
        id: r.id,
        finding_id: r.finding_id,
        document_id: r.document_id,
        organization_id: r.organization_id,
        reason: r.reason,
        operator_note: r.operator_note,
        created_at: r.created_at,
        organization_name: org?.name ?? "（不明）",
        finding_title: finding?.title ?? "（指摘）",
        doc_type: doc?.doc_type ?? "その他",
      }
    }
  )

  return { ok: true, data: { queue, metrics, feedback } }
}

async function writeReviewLog(
  service: ReturnType<
    typeof import("@/lib/supabase/server").createServiceClient
  >,
  input: {
    findingId: string
    organizationId: string
    reviewerId: string
    action: "approved" | "edited" | "rejected"
    durationMs: number
  }
) {
  const duration = Math.max(0, Math.min(Math.round(input.durationMs), 3_600_000))
  await service.from("finding_review_logs").insert({
    finding_id: input.findingId,
    organization_id: input.organizationId,
    reviewer_id: input.reviewerId,
    action: input.action,
    duration_ms: duration,
  })
}

export async function reviewFindingAction(input: {
  findingId: string
  decision: "approve" | "edit" | "reject"
  durationMs: number
  title?: string
  description?: string
  basis?: string
  suggestion?: string
}): Promise<ActionResult<{ remaining: number }>> {
  const ctx = await requireOperator()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { data: finding, error: findError } = await ctx.service
    .from("findings")
    .select("id, document_id, organization_id, review_status")
    .eq("id", input.findingId)
    .is("deleted_at", null)
    .maybeSingle()

  if (findError || !finding) {
    return { ok: false, error: "指摘が見つかりません。キューを更新してください。" }
  }

  if (finding.review_status !== "pending") {
    return { ok: false, error: "この指摘はすでに処理済みです。" }
  }

  const now = new Date().toISOString()

  if (input.decision === "reject") {
    const { error } = await ctx.service
      .from("findings")
      .update({
        review_status: "rejected",
        updated_at: now,
      })
      .eq("id", input.findingId)
      .eq("review_status", "pending")

    if (error) return { ok: false, error: toUserErrorMessage(error) }

    await writeReviewLog(ctx.service, {
      findingId: input.findingId,
      organizationId: finding.organization_id,
      reviewerId: ctx.userId,
      action: "rejected",
      durationMs: input.durationMs,
    })
  } else {
    const title = (input.title ?? "").trim()
    const description = (input.description ?? "").trim()
    if (input.decision === "edit") {
      if (!title || !description) {
        return {
          ok: false,
          error: "修正承認にはタイトルと説明が必要です。",
        }
      }
    }

    const patch: Record<string, unknown> = {
      review_status: "approved",
      updated_at: now,
    }
    if (input.decision === "edit") {
      patch.title = title
      patch.description = description
      patch.basis = input.basis?.trim() || null
      patch.suggestion = input.suggestion?.trim() || null
    }

    const { error } = await ctx.service
      .from("findings")
      .update(patch)
      .eq("id", input.findingId)
      .eq("review_status", "pending")

    if (error) return { ok: false, error: toUserErrorMessage(error) }

    await writeReviewLog(ctx.service, {
      findingId: input.findingId,
      organizationId: finding.organization_id,
      reviewerId: ctx.userId,
      action: input.decision === "edit" ? "edited" : "approved",
      durationMs: input.durationMs,
    })
  }

  const { count } = await ctx.service
    .from("findings")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "pending")
    .is("deleted_at", null)

  revalidatePath("/admin")
  revalidatePath(`/check/${finding.document_id}`)

  return { ok: true, data: { remaining: count ?? 0 } }
}

export async function updateFeedbackNoteAction(input: {
  feedbackId: string
  note: string
}): Promise<ActionResult> {
  const ctx = await requireOperator()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { error } = await ctx.service
    .from("finding_feedback")
    .update({
      operator_note: input.note.trim() || null,
      operator_note_updated_at: new Date().toISOString(),
      operator_id: ctx.userId,
    })
    .eq("id", input.feedbackId)

  if (error) return { ok: false, error: toUserErrorMessage(error) }

  revalidatePath("/admin")
  return { ok: true }
}
