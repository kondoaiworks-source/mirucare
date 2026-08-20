import { describe, expect, it } from "vitest"
import {
  buildEvidenceCoverage,
  coverageFromLayerCounts,
} from "@/lib/rule-engine/evidence-coverage"

describe("evidence-coverage", () => {
  it("is 0% when no readable PDFs are registered", () => {
    const coverage = buildEvidenceCoverage([
      {
        layer: "national",
        file_type: "html",
        official_url: "https://example.com/info",
        parent_page_url: "https://example.com/info",
      },
    ])
    expect(coverage.percent).toBe(0)
    expect(coverage.layers.every((l) => !l.filled)).toBe(true)
    expect(coverage.recommendedCategories.length).toBeGreaterThan(0)
  })

  it("counts 国・県・市 PDFs as coverage slots", () => {
    const coverage = buildEvidenceCoverage([
      {
        layer: "national",
        file_type: "pdf",
        direct_file_url: "https://example.com/n.pdf",
        hasText: true,
        material_category: "訪問介護",
      },
      {
        layer: "prefecture",
        file_type: "pdf",
        direct_file_url: "https://example.com/p.pdf",
        hasText: true,
      },
      {
        layer: "city",
        file_type: "pdf",
        direct_file_url: "https://example.com/c.pdf",
        hasText: false,
      },
    ])
    expect(coverage.percent).toBe(100)
    expect(coverage.nationalPrefectureCount).toBe(2)
    expect(coverage.cityCount).toBe(1)
    expect(coverage.categories.find((c) => c.category === "訪問介護")?.count).toBe(
      1
    )
    expect(
      coverage.recommendedCategories.some((c) => c.category === "事故報告")
    ).toBe(true)
  })

  it("builds coverage from layer counts on drafts", () => {
    const coverage = coverageFromLayerCounts({
      national: 4,
      prefecture: 1,
      city: 0,
    })
    expect(coverage.percent).toBe(67)
    expect(coverage.nationalPrefectureCount).toBe(5)
    expect(coverage.cityCount).toBe(0)
    expect(coverage.layers.find((l) => l.layer === "city")?.filled).toBe(false)
  })
})
