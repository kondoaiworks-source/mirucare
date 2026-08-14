import { describe, expect, it } from "vitest"
import {
  buildLinkageMonitorEvents,
  linkageResultLabel,
} from "@/lib/rule-engine/linkage-monitoring"

describe("buildLinkageMonitorEvents", () => {
  it("maps unchanged to OK and sorts by newest", () => {
    const events = buildLinkageMonitorEvents({
      documents: [
        {
          id: "d1",
          title: "古いPDF",
          last_sync_status: "unchanged",
          last_checked_at: "2026-07-01T00:00:00.000Z",
          last_error: null,
          status: "active",
        },
        {
          id: "d2",
          title: "新しいPDF",
          last_sync_status: "unchanged",
          last_checked_at: "2026-07-10T00:00:00.000Z",
          last_error: null,
          status: "active",
        },
      ],
      alerts: [],
      drafts: [],
    })
    expect(events).toHaveLength(2)
    expect(events[0]?.title).toBe("新しいPDF")
    expect(events[0]?.result).toBe("ok")
    expect(linkageResultLabel("ok")).toBe("OK")
  })

  it("prefers NG over OK for the same document", () => {
    const events = buildLinkageMonitorEvents({
      documents: [
        {
          id: "d1",
          title: "マニュアルA",
          last_sync_status: "unchanged",
          last_checked_at: "2026-07-10T12:00:00.000Z",
          last_error: null,
          status: "active",
        },
      ],
      alerts: [
        {
          id: "a1",
          knowledge_document_id: "d1",
          kind: "failed",
          message: "取得失敗",
          status: "open",
          created_at: "2026-07-10T11:00:00.000Z",
          resolved_at: null,
          resolved_by: null,
          knowledge_documents: { id: "d1", title: "マニュアルA" },
        } as never,
      ],
      drafts: [],
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.result).toBe("ng")
    expect(events[0]?.alertId).toBe("a1")
  })

  it("marks pending drafts as 差分あり", () => {
    const events = buildLinkageMonitorEvents({
      documents: [],
      alerts: [],
      drafts: [
        {
          id: "dr1",
          created_at: "2026-07-11T00:00:00.000Z",
          ai_summary: "第3章が更新",
          knowledge_documents: { id: "d9", title: "県マニュアル" },
        },
      ],
    })
    expect(events[0]?.result).toBe("diff")
    expect(events[0]?.draftId).toBe("dr1")
    expect(linkageResultLabel("diff")).toBe("差分あり")
  })

  it("keeps draftId when the same document also has a newer sync", () => {
    const events = buildLinkageMonitorEvents({
      documents: [
        {
          id: "d9",
          title: "県マニュアル",
          last_sync_status: "ok",
          last_checked_at: "2026-07-12T00:00:00.000Z",
          last_error: null,
          status: "active",
          source_url: "https://example.com/pref.pdf",
          jurisdiction_level: "都道府県",
          region_name: "神奈川県",
        },
      ],
      alerts: [],
      drafts: [
        {
          id: "dr1",
          created_at: "2026-07-11T00:00:00.000Z",
          ai_summary: "第3章が更新",
          knowledge_documents: { id: "d9", title: "県マニュアル" },
        },
      ],
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.result).toBe("diff")
    expect(events[0]?.draftId).toBe("dr1")
    expect(events[0]?.sourceUrl).toBe("https://example.com/pref.pdf")
    expect(events[0]?.jurisdictionLevel).toBe("都道府県")
  })
})
