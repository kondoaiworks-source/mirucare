import { toEmailSubjectLabel } from "@/lib/deadlines"
import { daysUntilDue, toDateOnly } from "@/lib/deadline-status"

export type ReminderDeadline = {
  subject: string
  kind: string
  due_date: string
}

/**
 * メール本文用。個人名は姓＋様まで。
 */
export function buildDeadlineReminderEmail(opts: {
  facilityName: string
  deadlines: ReminderDeadline[]
  appUrl: string
}): { subject: string; text: string; html: string } {
  const today = toDateOnly()
  const count = opts.deadlines.length
  const subject = `【監査のミカタ】本日〜7日以内の期限が${count}件あります`

  const lines = opts.deadlines.map((d) => {
    const days = daysUntilDue(d.due_date, today)
    const when =
      days < 0
        ? `${Math.abs(days)}日超過`
        : days === 0
          ? "本日"
          : `残り${days}日`
    return `・${toEmailSubjectLabel(d.subject)}（${d.kind}）／${when}`
  })

  const text = [
    `${opts.facilityName} 様`,
    "",
    `本日〜7日以内に確認が必要な期限が ${count}件 あります。`,
    "",
    ...lines,
    "",
    `アプリで確認する: ${opts.appUrl}/alerts`,
    "",
    "本サービスはWチェック支援であり、最終判断・提出は貴施設の責任で行ってください。",
  ].join("\n")

  const html = `
    <p>${escapeHtml(opts.facilityName)} 様</p>
    <p>本日〜7日以内に確認が必要な期限が <strong>${count}件</strong> あります。</p>
    <ul>
      ${opts.deadlines
        .map((d) => {
          const days = daysUntilDue(d.due_date, today)
          const when =
            days < 0
              ? `${Math.abs(days)}日超過`
              : days === 0
                ? "本日"
                : `残り${days}日`
          return `<li>${escapeHtml(toEmailSubjectLabel(d.subject))}（${escapeHtml(d.kind)}）／${escapeHtml(when)}</li>`
        })
        .join("")}
    </ul>
    <p><a href="${escapeHtml(opts.appUrl)}/alerts">アプリで確認する</a></p>
    <p style="color:#666;font-size:12px;">本サービスはWチェック支援であり、最終判断・提出は貴施設の責任で行ってください。</p>
  `

  return { subject, text, html }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export async function sendResendEmail(opts: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "監査のミカタ <onboarding@resend.dev>"

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY が未設定です" }
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    return { ok: false, error: body.slice(0, 200) }
  }

  return { ok: true }
}
