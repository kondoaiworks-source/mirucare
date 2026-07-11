import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildSubjectFromFinding,
  computeDeadlineStatus,
  extractDueDateFromText,
  inferDeadlineKind,
} from "@/lib/deadline-status"
import { toPrivacySubject } from "@/lib/deadlines"
import type { DeadlineKind } from "@/types/database"

type FindingLike = {
  id?: string
  title: string
  description: string
  suggestion?: string | null
}

/**
 * チェック結果から期限候補を自動生成（同意・交付・更新・モニタリング）
 */
export async function generateDeadlinesFromFindings(
  admin: SupabaseClient,
  opts: {
    organizationId: string
    documentId: string
    docType: string
    findings: FindingLike[]
  }
): Promise<number> {
  let created = 0

  for (const finding of opts.findings) {
    const blob = `${finding.title}\n${finding.description}\n${finding.suggestion ?? ""}`
    const kind = inferDeadlineKind(blob)
    if (!kind) continue

    const dueDate = extractDueDateFromText(blob, kindDefaultDays(kind))
    const subject = toPrivacySubject(
      buildSubjectFromFinding(finding.title, opts.docType)
    )
    const status = computeDeadlineStatus(dueDate, "ok")

    // 同一書類・同一種別・同一期限の重複を避ける
    const { data: existing } = await admin
      .from("deadlines")
      .select("id")
      .eq("organization_id", opts.organizationId)
      .eq("source_document_id", opts.documentId)
      .eq("kind", kind)
      .eq("due_date", dueDate)
      .is("deleted_at", null)
      .maybeSingle()

    if (existing) continue

    const { error } = await admin.from("deadlines").insert({
      organization_id: opts.organizationId,
      subject,
      kind,
      due_date: dueDate,
      source_document_id: opts.documentId,
      source_finding_id: finding.id ?? null,
      status,
    })

    if (!error) created += 1
  }

  return created
}

function kindDefaultDays(kind: DeadlineKind): number {
  switch (kind) {
    case "同意日":
      return 7
    case "交付日":
      return 7
    case "更新期限":
      return 30
    case "モニタリング":
      return 14
    default:
      return 14
  }
}
