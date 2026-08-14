import { describe, expect, it } from "vitest"
import {
  extraExistingRulesForDomain,
  findExistingRuleForTemplate,
  pickTemplateItemsForDomains,
} from "@/lib/rule-engine/compose-rulebook"
import { SYSTEM_DOMAIN_SEEDS } from "@/lib/rule-engine/domains"
import { HOME_VISIT_AUDIT_TEMPLATE_ITEMS } from "@/lib/rule-engine/home-visit-audit-template"

describe("compose-rulebook", () => {
  const domains = SYSTEM_DOMAIN_SEEDS.map((seed, i) => ({
    id: `id-${seed.slug}`,
    ...seed,
  }))

  it("dedupes template items when 全て is selected", () => {
    const picks = pickTemplateItemsForDomains({
      items: HOME_VISIT_AUDIT_TEMPLATE_ITEMS,
      domains,
    })
    const codes = picks.map((p) => p.item.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes).toContain("HC_GOV_STAFFING_STANDARDS")
    expect(codes).toContain("HC_GOV_WORK_PATTERN_LIST")
    expect(codes).toContain("HC_ADD_INITIAL")
    expect(codes).toContain("HC_BILLING_MISSING_OR_ERROR")
    expect(codes).not.toContain("HC_RECORD_VITAL_SIGNS")
  })

  it("reuses an existing rule by template code", () => {
    const item = HOME_VISIT_AUDIT_TEMPLATE_ITEMS.find(
      (i) => i.code === "HC_GOV_STAFFING_STANDARDS"
    )
    expect(item).toBeTruthy()
    if (!item) return
    const hit = findExistingRuleForTemplate(
      [
        {
          id: "r1",
          code: "SHR-000001",
          title: "別タイトル",
          domainId: "id-staffing",
          templateCode: "HC_GOV_STAFFING_STANDARDS",
        },
      ],
      item
    )
    expect(hit?.id).toBe("r1")
  })

  it("picks leftover city rules already tagged to the domain", () => {
    const staffing = domains[0]
    const extra = extraExistingRulesForDomain(
      [
        {
          id: "picked",
          code: "HC_GOV_STAFFING_STANDARDS",
          title: "人員基準",
          domainId: staffing.id,
        },
        {
          id: "city",
          code: "YOKOHAMA-1",
          title: "横浜市の常勤換算の独自様式",
          domainId: staffing.id,
        },
      ],
      staffing,
      new Set(["picked"])
    )
    expect(extra.map((r) => r.id)).toEqual(["city"])
  })
})
