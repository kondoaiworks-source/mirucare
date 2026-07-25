import { describe, expect, it } from "vitest"
import {
  classifyRuleScope,
  isRuleApplicableToCity,
} from "@/lib/rule-engine/city-rule-scope"

describe("classifyRuleScope", () => {
  it("marks same city as city", () => {
    expect(
      classifyRuleScope({
        cityName: "横浜市",
        prefectureName: "神奈川県",
        regionName: "横浜市",
        jurisdictionLevel: "市区町村",
      })
    ).toBe("city")
  })

  it("marks other phase1 city as other_city", () => {
    expect(
      classifyRuleScope({
        cityName: "横浜市",
        prefectureName: "神奈川県",
        regionName: "川崎市",
        jurisdictionLevel: "市区町村",
      })
    ).toBe("other_city")
  })

  it("marks national as shared", () => {
    expect(
      classifyRuleScope({
        cityName: "横浜市",
        prefectureName: "神奈川県",
        regionName: null,
        jurisdictionLevel: "国",
      })
    ).toBe("shared")
  })

  it("marks empty linkage as unscoped", () => {
    expect(
      classifyRuleScope({
        cityName: "横浜市",
        prefectureName: "神奈川県",
      })
    ).toBe("unscoped")
  })

  it("applies city/shared/unscoped only", () => {
    expect(isRuleApplicableToCity("city")).toBe(true)
    expect(isRuleApplicableToCity("shared")).toBe(true)
    expect(isRuleApplicableToCity("unscoped")).toBe(true)
    expect(isRuleApplicableToCity("other_city")).toBe(false)
  })
})
