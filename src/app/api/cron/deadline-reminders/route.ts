import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import {
  buildDeadlineReminderEmail,
  sendResendEmail,
} from "@/lib/email/deadline-reminder"
import { daysUntilDue, toDateOnly } from "@/lib/deadline-status"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * 毎朝の期限リマインド（Supabase cron / Vercel cron から呼び出し）
 * Authorization: Bearer ${CRON_SECRET}
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = request.headers.get("authorization") ?? ""
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createServiceClient()
  const today = toDateOnly()
  const in7 = new Date()
  in7.setDate(in7.getDate() + 7)
  const in7Str = toDateOnly(in7)
  const appUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "")

  const { data: orgs, error: orgError } = await admin
    .from("organizations")
    .select("id, name")
    .is("deleted_at", null)
    .in("plan", ["standard", "premium"])

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  let sent = 0
  let skipped = 0

  for (const org of orgs ?? []) {
    const { data: deadlines } = await admin
      .from("deadlines")
      .select("subject, kind, due_date, status")
      .eq("organization_id", org.id)
      .is("deleted_at", null)
      .neq("status", "done")
      .lte("due_date", in7Str)

    const dueSoon = (deadlines ?? []).filter((d) => {
      const days = daysUntilDue(d.due_date, today)
      return days <= 7 // 超過も含む
    })

    if (dueSoon.length === 0) {
      skipped += 1
      continue
    }

    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", org.id)
      .eq("role", "admin")
      .is("deleted_at", null)

    const adminIds = (admins ?? []).map((a) => a.id)
    if (adminIds.length === 0) {
      skipped += 1
      continue
    }

    // auth.users のメールは service role の auth.admin で取得
    const emails: string[] = []
    for (const id of adminIds) {
      const { data } = await admin.auth.admin.getUserById(id)
      const email = data.user?.email
      if (email) emails.push(email)
    }

    if (emails.length === 0) {
      skipped += 1
      continue
    }

    const mail = buildDeadlineReminderEmail({
      facilityName: org.name,
      deadlines: dueSoon.map((d) => ({
        subject: d.subject,
        kind: d.kind,
        due_date: d.due_date,
      })),
      appUrl,
    })

    for (const to of emails) {
      const result = await sendResendEmail({
        to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      })
      if (result.ok) sent += 1
    }
  }

  return NextResponse.json({ ok: true, sent, skipped })
}

/** Vercel Cron は GET のこともある */
export async function GET(request: Request) {
  return POST(request)
}
