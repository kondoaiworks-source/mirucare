import { describe, expect, it } from "vitest"
import {
  looksLikeDirectFileUrl,
  ruleSourceHasReadableText,
} from "@/lib/rule-engine/source-urls"

describe("source-urls", () => {
  it("treats a PDF path as a direct file", () => {
    expect(
      looksLikeDirectFileUrl("https://example.jp/docs/staffing.pdf")
    ).toBe(true)
    expect(looksLikeDirectFileUrl("https://example.jp/list", "pdf")).toBe(true)
  })

  it("treats an HTML list page as not a direct file", () => {
    expect(
      looksLikeDirectFileUrl("https://example.jp/kaigo/oshirase/")
    ).toBe(false)
    expect(looksLikeDirectFileUrl(null)).toBe(false)
  })

  it("finds readable text by document id or matching URL", () => {
    const documents = [
      {
        id: "d1",
        source_url: "https://example.jp/a.pdf",
        hasTextSnapshot: true,
      },
      {
        id: "d2",
        source_url: "https://example.jp/b.html",
        hasTextSnapshot: false,
      },
    ]
    expect(
      ruleSourceHasReadableText({
        knowledgeDocumentId: "d1",
        url: "https://example.jp/other",
        documents,
      })
    ).toBe(true)
    expect(
      ruleSourceHasReadableText({
        knowledgeDocumentId: null,
        url: "https://example.jp/a.pdf",
        documents,
      })
    ).toBe(true)
    expect(
      ruleSourceHasReadableText({
        knowledgeDocumentId: "d2",
        url: "https://example.jp/b.html",
        documents,
      })
    ).toBe(false)
  })
})
