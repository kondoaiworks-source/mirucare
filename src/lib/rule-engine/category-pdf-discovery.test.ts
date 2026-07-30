import { describe, expect, it } from "vitest"
import { AUDIT_CATEGORIES } from "@/lib/rule-engine/audit-categories"
import {
  pickDiscoverableSources,
  sourceMatchesAuditCategoryKeywords,
} from "@/lib/rule-engine/category-pdf-discovery"

const carePlan = AUDIT_CATEGORIES.find((c) => c.slug === "care-plan")!

describe("sourceMatchesAuditCategoryKeywords", () => {
  it("matches care-plan keywords", () => {
    expect(
      sourceMatchesAuditCategoryKeywords(
        { title: "訪問介護計画書の取扱いについて", memo: null },
        carePlan
      )
    ).toBe(true)
  })

  it("rejects unrelated titles", () => {
    expect(
      sourceMatchesAuditCategoryKeywords(
        { title: "国保連請求の手引き", memo: null },
        carePlan
      )
    ).toBe(false)
  })
})

describe("pickDiscoverableSources", () => {
  it("skips linked and rejected, requires URL", () => {
    const sources = [
      {
        id: "a",
        title: "ケアプランと訪問介護計画",
        parent_page_url: "https://example.com/a",
        direct_file_url: null,
        memo: null,
        jurisdiction_id: "j1",
      },
      {
        id: "b",
        title: "ケアプラン解説",
        parent_page_url: null,
        direct_file_url: null,
        memo: null,
        jurisdiction_id: "j1",
      },
      {
        id: "c",
        title: "ケアプラン様式",
        parent_page_url: "https://example.com/c",
        direct_file_url: "https://example.com/c.pdf",
        memo: null,
        jurisdiction_id: "j1",
      },
    ]
    const picked = pickDiscoverableSources({
      sources,
      category: carePlan,
      alreadyLinkedSourceIds: new Set(["a"]),
      rejectedSourceIds: new Set(["c"]),
    })
    expect(picked.map((s) => s.id)).toEqual([])
  })

  it("returns unlinked matching sources with URL", () => {
    const picked = pickDiscoverableSources({
      sources: [
        {
          id: "x",
          title: "訪問介護計画書ガイドライン",
          parent_page_url: "https://example.com/x",
          direct_file_url: null,
          memo: null,
          jurisdiction_id: "j1",
        },
      ],
      category: carePlan,
      alreadyLinkedSourceIds: new Set(),
      rejectedSourceIds: new Set(),
    })
    expect(picked).toHaveLength(1)
    expect(picked[0]?.id).toBe("x")
  })
})
