/**
 * マニュアル変更検知 → 承認待ちドラフトの通知メール
 */

import { sendResendEmail } from "@/lib/email/deadline-reminder"
import type { KnowledgeDocument } from "@/types/database"

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function parseEmailList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"))
}

/**
 * notify_emails → OPERATOR_EMAILS の順で送信先を決定
 */
export function resolveChangeDraftNotifyEmails(
  doc: Pick<KnowledgeDocument, "notify_emails">
): string[] {
  const fromDoc = parseEmailList(doc.notify_emails)
  if (fromDoc.length > 0) return Array.from(new Set(fromDoc))
  return Array.from(new Set(parseEmailList(process.env.OPERATOR_EMAILS)))
}

export function buildKnowledgeChangeDraftEmail(opts: {
  documentTitle: string
  aiSummary: string | null
  aiOrganized: boolean
  needsReview: boolean
  appUrl: string
}): { subject: string; text: string; html: string } {
  const subject = `【監査のミカタ】「${opts.documentTitle}」に変更が検知された可能性があります`

  const flags: string[] = []
  if (!opts.aiOrganized) flags.push("AI整理なし")
  if (opts.needsReview) flags.push("要精査")

  const summary =
    opts.aiSummary?.trim() ||
    "要約はありません。承認画面で原文をご確認ください。"

  const reviewUrl = `${opts.appUrl}/admin/document-changes`

  const text = [
    "行政マニュアルの内容に変更が検知された可能性があります。",
    "",
    `マニュアル名: ${opts.documentTitle}`,
    flags.length > 0 ? `注意: ${flags.join(" / ")}` : null,
    "",
    "AI要約:",
    summary,
    "",
    `承認画面で確認する: ${reviewUrl}`,
    "",
    "本サービスはWチェック支援であり、最終判断・提出は貴施設の責任で行ってください。",
  ]
    .filter((line) => line != null)
    .join("\n")

  const html = `
    <p>行政マニュアルの内容に変更が検知された可能性があります。</p>
    <p><strong>マニュアル名:</strong> ${escapeHtml(opts.documentTitle)}</p>
    ${
      flags.length > 0
        ? `<p><strong>注意:</strong> ${escapeHtml(flags.join(" / "))}</p>`
        : ""
    }
    <p><strong>AI要約:</strong></p>
    <p>${escapeHtml(summary)}</p>
    <p><a href="${escapeHtml(reviewUrl)}">承認画面で確認する</a></p>
    <p style="color:#666;font-size:12px;">本サービスはWチェック支援であり、最終判断・提出は貴施設の責任で行ってください。</p>
  `

  return { subject, text, html }
}

/**
 * ドラフト作成直後の通知。Resend未設定時は失敗ログのみ（処理は止めない）。
 */
export async function notifyChangeDraftCreated(opts: {
  doc: Pick<KnowledgeDocument, "title" | "notify_emails">
  aiSummary: string | null
  aiOrganized: boolean
  quoteVerifiedRatio: number | null
}): Promise<{ sent: number; failed: number }> {
  const recipients = resolveChangeDraftNotifyEmails(opts.doc)
  if (recipients.length === 0) {
    console.error("[knowledge-draft-notify] no_recipients", {
      title: opts.doc.title.slice(0, 80),
    })
    return { sent: 0, failed: 0 }
  }

  const needsReview =
    !opts.aiOrganized ||
    opts.quoteVerifiedRatio == null ||
    Number(opts.quoteVerifiedRatio) < 1

  const appUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "")

  const mail = buildKnowledgeChangeDraftEmail({
    documentTitle: opts.doc.title,
    aiSummary: opts.aiSummary,
    aiOrganized: opts.aiOrganized,
    needsReview,
    appUrl,
  })

  let sent = 0
  let failed = 0
  for (const to of recipients) {
    const result = await sendResendEmail({
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
    if (result.ok) {
      sent += 1
    } else {
      failed += 1
      console.error("[knowledge-draft-notify] email_failed", {
        error: result.error?.slice(0, 120),
      })
    }
  }

  return { sent, failed }
}
