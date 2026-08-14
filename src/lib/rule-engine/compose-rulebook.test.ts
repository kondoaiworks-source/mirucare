import { describe, expect, it } from "vitest"
import {
  extraExistingRulesForDomain,
  findExistingRuleForTemplate,
  isDuplicateCityProposalTitle,
  isThinComposeGuidance,
  composeItemGuidance,
  pickDomainForCityProposal,
  pickTemplateItemsForDomains,
  summarizeExtractionNotes,
  COMPOSE_NO_TEXT_HINT,
} from "@/lib/rule-engine/compose-rulebook"
import { SYSTEM_DOMAIN_SEEDS } from "@/lib/rule-engine/domains"
import { HOME_VISIT_AUDIT_TEMPLATE_ITEMS } from "@/lib/rule-engine/home-visit-audit-template"

describe("compose-rulebook", () => {
  const domains = SYSTEM_DOMAIN_SEEDS.map((seed) => ({
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
          scopeKind: "shared",
        },
        {
          id: "city",
          code: "YOKOHAMA-1",
          title: "横浜市の常勤換算の独自様式",
          domainId: staffing.id,
          scopeKind: "city",
        },
      ],
      staffing,
      new Set(["picked"])
    )
    expect(extra.map((r) => r.id)).toEqual(["city"])
    expect(extra[0]?.scopeKind).toBe("city")
  })

  it("assigns a city proposal to the matching domain", () => {
    const staffing = domains[0]
    const billing = domains.find((d) => d.slug === "billing")
    expect(staffing).toBeTruthy()
    expect(
      pickDomainForCityProposal(
        {
          title: "横浜市の常勤換算の独自様式",
          guidanceText: "常勤換算の人数をご確認ください。",
        },
        domains
      )
    ).toBe(staffing.id)
    expect(
      pickDomainForCityProposal(
        {
          title: "過誤申立の独自期限",
          guidanceText: "請求の過誤申立期限をご確認ください。",
        },
        domains
      )
    ).toBe(billing?.id)
  })

  it("skips duplicate city proposal titles", () => {
    expect(
      isDuplicateCityProposalTitle("横浜市の独自様式", ["横浜市の独自様式"])
    ).toBe(true)
    expect(
      isDuplicateCityProposalTitle("横浜市の独自様式", ["別ルール"])
    ).toBe(false)
  })

  it("treats the old template memo as thin guidance", () => {
    expect(
      isThinComposeGuidance(
        "訪問介護監査項目（最大公約数）の「指定・運営体制」内にある「管理者配置」の観点です。関連書類・記録をご確認ください。"
      )
    ).toBe(true)
    expect(
      isThinComposeGuidance(
        "勤務表・雇用契約・資格証で、管理者が配置されているかご確認ください。"
      )
    ).toBe(false)
  })

  it("writes comparison-style template guidance instead of a section memo", () => {
    const item = HOME_VISIT_AUDIT_TEMPLATE_ITEMS.find(
      (i) => i.code === "HC_GOV_MANAGER_PLACEMENT"
    )
    expect(item).toBeTruthy()
    if (!item) return
    const text = composeItemGuidance(item)
    expect(text).toContain("勤務表")
    expect(text).toContain("ご確認ください")
    expect(text).not.toContain("最大公約数")
  })

  it("summarizes extraction notes for the toast", () => {
    expect(
      summarizeExtractionNotes([
        {
          layer: "national",
          label: "国",
          status: "extracted",
          sourceCount: 2,
          textCount: 2,
          ruleCount: 5,
          message: "国の公式資料から 5件を載せました。",
        },
        {
          layer: "city",
          label: "横浜市",
          status: "no_sources",
          sourceCount: 0,
          textCount: 0,
          ruleCount: 0,
          message: "横浜市の資料はまだありません。",
        },
      ])
    ).toBe("公式資料から国 5件を載せました。")
  })

  it("tells operators to fix links when there is no source text", () => {
    expect(COMPOSE_NO_TEXT_HINT).toContain("資料先")
    expect(COMPOSE_NO_TEXT_HINT).toContain("PDF")
  })
})
