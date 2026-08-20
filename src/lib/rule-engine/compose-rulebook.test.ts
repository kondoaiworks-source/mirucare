import { describe, expect, it } from "vitest"
import {
  extraExistingRulesForDomain,
  extraForPerDocExtract,
  findExistingRuleForTemplate,
  isDuplicateCityProposalTitle,
  isThinComposeGuidance,
  composeItemGuidance,
  pickDomainForCityProposal,
  pickTemplateItemsForDomains,
  resolvePerDocExtractStatus,
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
    expect(COMPOSE_NO_TEXT_HINT).toContain("根拠情報")
    expect(COMPOSE_NO_TEXT_HINT).toContain("PDF")
  })

  it("keeps extracted rules when some documents fail", () => {
    expect(
      resolvePerDocExtractStatus({
        attempted: 3,
        succeeded: 2,
        failed: 1,
        emptyResponses: 0,
        duplicateSkipped: 0,
        thinSkipped: 0,
        supplementCreated: 0,
        created: 5,
        timedOut: false,
        unavailable: false,
      })
    ).toBe("extracted")
    expect(
      extraForPerDocExtract(
        "横浜市",
        {
          attempted: 3,
          succeeded: 2,
          failed: 1,
          emptyResponses: 0,
          duplicateSkipped: 0,
          thinSkipped: 0,
          supplementCreated: 0,
          created: 5,
          timedOut: false,
          unavailable: false,
        },
        "extracted"
      )
    ).toContain("5件を載せました")
    expect(
      extraForPerDocExtract(
        "横浜市",
        {
          attempted: 3,
          succeeded: 2,
          failed: 1,
          emptyResponses: 0,
          duplicateSkipped: 0,
          thinSkipped: 0,
          supplementCreated: 0,
          created: 5,
          timedOut: false,
          unavailable: false,
        },
        "extracted"
      )
    ).toContain("本文 1件は観点を出せませんでした")
  })

  it("marks the layer failed only when no document produced rules", () => {
    expect(
      resolvePerDocExtractStatus({
        attempted: 3,
        succeeded: 0,
        failed: 3,
        emptyResponses: 0,
        duplicateSkipped: 0,
        thinSkipped: 0,
        supplementCreated: 0,
        created: 0,
        timedOut: false,
        unavailable: false,
      })
    ).toBe("ai_failed")
    expect(
      resolvePerDocExtractStatus({
        attempted: 0,
        succeeded: 0,
        failed: 0,
        emptyResponses: 0,
        duplicateSkipped: 0,
        thinSkipped: 0,
        supplementCreated: 0,
        created: 0,
        timedOut: true,
        unavailable: false,
      })
    ).toBe("ai_failed")
  })

  it("explains why no new official-source candidates were added", () => {
    const message = extraForPerDocExtract(
      "横浜市",
      {
        attempted: 2,
        succeeded: 2,
        failed: 0,
        emptyResponses: 1,
        duplicateSkipped: 3,
        thinSkipped: 1,
        supplementCreated: 0,
        created: 0,
        timedOut: false,
        unavailable: false,
      },
      "empty"
    )
    expect(message).toContain("新しく追加する候補はありませんでした")
    expect(message).toContain("既存ルールに含まれている可能性")
    expect(message).toContain("今回は使わない候補 1件")
  })

  it("summarizes municipality supplement candidates separately", () => {
    const message = extraForPerDocExtract(
      "横浜市",
      {
        attempted: 2,
        succeeded: 2,
        failed: 0,
        emptyResponses: 2,
        duplicateSkipped: 0,
        thinSkipped: 0,
        supplementCreated: 2,
        created: 2,
        timedOut: false,
        unavailable: false,
      },
      "extracted"
    )
    expect(message).toContain("自治体だけの補足候補 2件")
    expect(message).toContain("本文 2件は、新しく追加する候補がありませんでした")
  })
})
