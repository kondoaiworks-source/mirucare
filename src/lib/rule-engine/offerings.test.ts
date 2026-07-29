import { describe, expect, it } from "vitest"
import {
  buildPublishedCatalog,
  evaluatePublishReadiness,
  isAllowedMunicipalitySelection,
  isAllowedServiceSelection,
} from "@/lib/rule-engine/offerings"

describe("evaluatePublishReadiness", () => {
  it("requires national, prefecture, and city PDFs", () => {
    expect(
      evaluatePublishReadiness({
        nationalPdfCount: 0,
        prefecturePdfCount: 1,
        cityPdfCount: 1,
      }).canPublish
    ).toBe(false)
    expect(
      evaluatePublishReadiness({
        nationalPdfCount: 1,
        prefecturePdfCount: 1,
        cityPdfCount: 1,
      }).canPublish
    ).toBe(true)
  })
})

describe("published catalog selection", () => {
  const catalog = buildPublishedCatalog([
    {
      serviceType: "訪問介護",
      municipalityName: "横浜市",
      prefectureName: "神奈川県",
      isPublished: true,
    },
    {
      serviceType: "通所介護",
      municipalityName: "横浜市",
      prefectureName: "神奈川県",
      isPublished: false,
    },
  ])

  it("lists only published services", () => {
    expect(catalog.services).toEqual(["訪問介護"])
  })

  it("allows existing unpublished municipality to stay", () => {
    const ok = isAllowedMunicipalitySelection({
      catalog,
      serviceType: "訪問介護",
      municipality: "川崎市",
      skipMunicipality: false,
      existingMunicipality: "川崎市",
    })
    expect(ok).toEqual({ ok: true })
  })

  it("blocks new unpublished municipality", () => {
    const ng = isAllowedMunicipalitySelection({
      catalog,
      serviceType: "訪問介護",
      municipality: "川崎市",
      skipMunicipality: false,
    })
    expect(ng.ok).toBe(false)
  })

  it("blocks unpublished service for new orgs", () => {
    const ng = isAllowedServiceSelection({
      catalog,
      serviceType: "通所介護",
    })
    expect(ng.ok).toBe(false)
  })
})
