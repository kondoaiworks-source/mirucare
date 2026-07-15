/**
 * ナレッジ自動収集の失敗・疑いを運営へ通知するメール。
 */
export function buildKnowledgeSyncAlertEmail(opts: {
  documentTitle: string
  kind: "failed" | "suspicious"
  message: string
  appUrl: string
}): { subject: string; text: string; html: string } {
  const kindLabel =
    opts.kind === "failed"
      ? "自動取得に失敗した可能性"
      : "内容に疑いがあり確認が必要"

  const subject = `【監査のミカタ】行政マニュアル：${kindLabel}`

  const text = [
    "運営向けアラートです。",
    "",
    `マニュアル名: ${opts.documentTitle}`,
    `種別: ${kindLabel}`,
    "",
    opts.message,
    "",
    `管理画面で確認する: ${opts.appUrl}/admin/documents`,
    "",
    "本サービスはWチェック支援であり、最終判断・提出は貴施設の責任で行ってください。",
  ].join("\n")

  const html = `
    <p>運営向けアラートです。</p>
    <p><strong>マニュアル名:</strong> ${escapeHtml(opts.documentTitle)}</p>
    <p><strong>種別:</strong> ${escapeHtml(kindLabel)}</p>
    <p>${escapeHtml(opts.message)}</p>
    <p><a href="${escapeHtml(opts.appUrl)}/admin/documents">管理画面で確認する</a></p>
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
