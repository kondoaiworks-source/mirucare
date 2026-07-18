import { describe, expect, it } from "vitest"
import {
  buildKnowledgeChangeDraftEmail,
  resolveChangeDraftNotifyEmails,
} from "./knowledge-change-draft"

describe("resolveChangeDraftNotifyEmails", () => {
  it("notify_emails を優先する", () => {
    const prev = process.env.OPERATOR_EMAILS
    process.env.OPERATOR_EMAILS = "ops@example.com"
    try {
      expect(
        resolveChangeDraftNotifyEmails({
          notify_emails: "a@example.com, b@example.com",
        })
      ).toEqual(["a@example.com", "b@example.com"])
    } finally {
      process.env.OPERATOR_EMAILS = prev
    }
  })

  it("未設定時は OPERATOR_EMAILS へフォールバック", () => {
    const prev = process.env.OPERATOR_EMAILS
    process.env.OPERATOR_EMAILS = "ops@example.com, other@example.com"
    try {
      expect(resolveChangeDraftNotifyEmails({ notify_emails: null })).toEqual([
        "ops@example.com",
        "other@example.com",
      ])
    } finally {
      process.env.OPERATOR_EMAILS = prev
    }
  })
})

describe("buildKnowledgeChangeDraftEmail", () => {
  it("承認画面リンクと要約を含む", () => {
    const mail = buildKnowledgeChangeDraftEmail({
      documentTitle: "テストマニュアル",
      aiSummary: "要点です。",
      aiOrganized: true,
      needsReview: false,
      appUrl: "https://example.com",
    })
    expect(mail.subject).toContain("テストマニュアル")
    expect(mail.text).toContain("要点です。")
    expect(mail.text).toContain(
      "https://example.com/admin/document-changes"
    )
  })
})
