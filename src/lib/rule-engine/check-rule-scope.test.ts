import { describe, expect, it } from "vitest"
import {
  checkRulesManagePath,
  checkRulesManagePathFromDocument,
  composeRulebookPathFromDocument,
  documentMatchesRuleScope,
  formatAllocatedRuleCode,
  isRuleInMunicipalityCheckScope,
  ruleCodePrefix,
  type CheckRuleManageContext,
} from "@/lib/rule-engine/check-rule-scope"

const yokohama: CheckRuleManageContext = {
  serviceSlug: "homecare",
  serviceLabel: "訪問介護",
  scopeKind: "city",
  jurisdictionId: "jid-yokohama",
  citySlug: "yokohama",
  cityName: "横浜市",
}

const shared: CheckRuleManageContext = {
  serviceSlug: "homecare",
  serviceLabel: "訪問介護",
  scopeKind: "shared",
  jurisdictionId: null,
}

describe("check-rule-scope", () => {
  it("formats internal codes without operator input", () => {
    expect(formatAllocatedRuleCode("shr", 1)).toBe("SHR-000001")
    expect(formatAllocatedRuleCode("yokohama", 12)).toBe("YOKOHAMA-000012")
    expect(ruleCodePrefix(shared)).toBe("SHR")
    expect(ruleCodePrefix(yokohama)).toBe("YOKOHAMA")
  })

  it("places manage screens on ルールブックを見る", () => {
    expect(checkRulesManagePath(shared)).toBe(
      "/admin/rules/services/homecare/book?city=national-prefecture"
    )
    expect(checkRulesManagePath(yokohama)).toBe(
      "/admin/rules/services/homecare/book?city=yokohama"
    )
  })

  it("routes a changed document to ルールブックを作る", () => {
    expect(
      composeRulebookPathFromDocument({
        jurisdictionLevel: "市区町村",
        regionName: "横浜市",
      })
    ).toBe(
      "/admin/rules/services/homecare/compose?city=yokohama&reason=source-changed"
    )
    expect(
      composeRulebookPathFromDocument({
        jurisdictionLevel: "国",
        regionName: null,
      })
    ).toBe("/admin/rules/services/homecare/compose?reason=source-changed")
  })

  it("routes a document to the matching rulebook view", () => {
    expect(
      checkRulesManagePathFromDocument({
        jurisdictionLevel: "国",
        regionName: null,
      })
    ).toBe("/admin/rules/services/homecare/book?city=national-prefecture")
    expect(
      checkRulesManagePathFromDocument({
        jurisdictionLevel: "市区町村",
        regionName: "横浜市",
      })
    ).toBe("/admin/rules/services/homecare/book?city=yokohama")
  })

  it("filters propose documents to the current screen", () => {
    expect(
      documentMatchesRuleScope(
        { jurisdiction_level: "国", region_name: null },
        shared
      )
    ).toBe(true)
    expect(
      documentMatchesRuleScope(
        { jurisdiction_level: "市区町村", region_name: "横浜市" },
        shared
      )
    ).toBe(false)
    expect(
      documentMatchesRuleScope(
        { jurisdiction_level: "市区町村", region_name: "横浜市" },
        yokohama
      )
    ).toBe(true)
    expect(
      documentMatchesRuleScope(
        { jurisdiction_level: "市区町村", region_name: "川崎市" },
        yokohama
      )
    ).toBe(false)
  })

  it("Yokohama check = shared + Yokohama city only", () => {
    expect(
      isRuleInMunicipalityCheckScope({
        scopeKind: "shared",
        ruleJurisdictionId: null,
        cityJurisdictionId: "jid-yokohama",
      })
    ).toBe(true)
    expect(
      isRuleInMunicipalityCheckScope({
        scopeKind: "city",
        ruleJurisdictionId: "jid-yokohama",
        cityJurisdictionId: "jid-yokohama",
      })
    ).toBe(true)
    expect(
      isRuleInMunicipalityCheckScope({
        scopeKind: "city",
        ruleJurisdictionId: "jid-kawasaki",
        cityJurisdictionId: "jid-yokohama",
      })
    ).toBe(false)
  })
})
