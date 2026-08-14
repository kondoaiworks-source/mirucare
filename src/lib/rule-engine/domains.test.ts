import { describe, expect, it } from "vitest"
import { HOME_VISIT_AUDIT_TEMPLATE_ITEMS } from "@/lib/rule-engine/home-visit-audit-template"
import {
  ALL_DOMAINS_VALUE,
  SYSTEM_DOMAIN_SEEDS,
  allocateDomainSlug,
  canDeleteDomain,
  parseKeywordInput,
  resolveSelectedDomains,
  ruleMatchesDomain,
  slugifyDomainTitle,
  templateItemMatchesDomain,
} from "@/lib/rule-engine/domains"

describe("domains master", () => {
  it("keeps four system domains and treats 全て as a virtual option", () => {
    expect(SYSTEM_DOMAIN_SEEDS.map((d) => d.slug)).toEqual([
      "staffing",
      "shift-table",
      "addition-reduction",
      "billing",
    ])
    expect(ALL_DOMAINS_VALUE).toBe("__all__")
    expect(SYSTEM_DOMAIN_SEEDS.some((d) => d.slug === ALL_DOMAINS_VALUE)).toBe(
      false
    )
  })

  it("matches 人員基準 to staffing template items", () => {
    const staffing = SYSTEM_DOMAIN_SEEDS[0]
    const hit = HOME_VISIT_AUDIT_TEMPLATE_ITEMS.filter((item) =>
      templateItemMatchesDomain(item, staffing)
    )
    expect(hit.some((i) => i.code === "HC_GOV_STAFFING_STANDARDS")).toBe(true)
    expect(hit.some((i) => i.category === "人員")).toBe(true)
  })

  it("matches 勤務表 without pulling all 記録 items", () => {
    const shift = SYSTEM_DOMAIN_SEEDS[1]
    const hit = HOME_VISIT_AUDIT_TEMPLATE_ITEMS.filter((item) =>
      templateItemMatchesDomain(item, shift)
    )
    expect(hit.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "HC_GOV_WORK_PATTERN_LIST",
        "HC_PLAN_ASSIGNEE",
        "HC_RECORD_SERVICE_DATETIME",
      ])
    )
    expect(hit.some((i) => i.code === "HC_RECORD_VITAL_SIGNS")).toBe(false)
  })

  it("matches 加算・減算 and 請求要件 by category", () => {
    const addition = SYSTEM_DOMAIN_SEEDS[2]
    const billing = SYSTEM_DOMAIN_SEEDS[3]
    expect(
      templateItemMatchesDomain(
        { code: "HC_ADD_INITIAL", title: "初回加算", category: "加算" },
        addition
      )
    ).toBe(true)
    expect(
      templateItemMatchesDomain(
        { code: "HC_BILLING_MISSING_OR_ERROR", title: "過誤請求", category: "請求" },
        billing
      )
    ).toBe(true)
    expect(
      ruleMatchesDomain(
        { code: "SHR-1", title: "処遇改善加算の根拠資料" },
        addition
      )
    ).toBe(true)
  })

  it("blocks deleting system or in-use domains", () => {
    expect(canDeleteDomain({ isSystem: true, linkedRuleCount: 0 }).ok).toBe(
      false
    )
    expect(canDeleteDomain({ isSystem: false, linkedRuleCount: 2 }).ok).toBe(
      false
    )
    expect(canDeleteDomain({ isSystem: false, linkedRuleCount: 0 })).toEqual({
      ok: true,
    })
  })

  it("parses keywords and allocates unique slugs", () => {
    expect(parseKeywordInput("人員、 常勤換算\n配置")).toEqual([
      "人員",
      "常勤換算",
      "配置",
    ])
    expect(slugifyDomainTitle("人員基準")).toBeNull()
    expect(slugifyDomainTitle("BCP Plan")).toBe("bcp-plan")
    expect(allocateDomainSlug("BCP Plan", ["bcp-plan"])).toBe("bcp-plan-2")
  })

  it("resolves 全て to active domains only", () => {
    const rows = [
      { id: "a", status: "active" as const },
      { id: "b", status: "retired" as const },
      { id: "c", status: "active" as const },
    ]
    const all = resolveSelectedDomains(ALL_DOMAINS_VALUE, rows)
    expect("error" in all).toBe(false)
    if ("error" in all) return
    expect(all.all).toBe(true)
    expect(all.domains.map((d) => d.id)).toEqual(["a", "c"])

    const stopped = resolveSelectedDomains("b", rows)
    expect("error" in stopped).toBe(true)
  })
})
