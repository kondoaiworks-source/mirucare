import { describe, expect, it } from "vitest"
import { buildCityRulebookSetupReadiness } from "@/lib/rule-engine/city-rulebook-setup-readiness"
import { getPhase1ExpectedRules } from "@/lib/rule-engine/phase1-rule-groups"
import { PHASE1_CITIES } from "@/lib/rule-engine/phase1-cities"

describe("buildCityRulebookSetupReadiness", () => {
  const city = PHASE1_CITIES[0]

  it("starts as 未着手 when nothing is configured", () => {
    const r = buildCityRulebookSetupReadiness({
      city,
      nationalSourceCount: 0,
      prefectureSourceCount: 0,
      citySourceCount: 0,
      nationalDocumentCount: 0,
      prefectureDocumentCount: 0,
      cityDocumentCount: 0,
      phase1AuditItemCodes: [],
      approvedRules: [],
      pendingRuleCount: 0,
      pendingDraftCount: 0,
      openAlertCount: 0,
    })
    expect(r.statusLabel).toBe("未着手")
    expect(r.phase1Checks.every((c) => !c.done)).toBe(true)
  })

  it("marks complete when layers, audit, rules, and evidence are ready", () => {
    const auditCodes = Array.from(
      new Set(getPhase1ExpectedRules().map((r) => r.auditItemCode))
    )
    const approvedRules = getPhase1ExpectedRules().map((exp, i) => ({
      versionId: `v-${i}`,
      ruleId: `r-${i}`,
      code: exp.code,
      title: exp.title,
      versionNo: 1,
      guidanceText: "test",
      severity: "mid" as const,
      effectiveFrom: "2026-01-01",
      changeSummary: null,
      scopeKind: "shared" as const,
      domainId: null,
      category: "計画" as const,
      auditItemTitle: exp.title,
      sourceDocumentId: "doc-1",
      sourceDocumentTitle: "厚労省マニュアル",
      sourceDocumentUrl: null,
      evidenceSummary: "根拠あり",
      evidenceQuotes: ["引用"],
      reviewStatus: "approved" as const,
    }))

    const r = buildCityRulebookSetupReadiness({
      city,
      nationalSourceCount: 2,
      prefectureSourceCount: 1,
      citySourceCount: 1,
      nationalDocumentCount: 1,
      prefectureDocumentCount: 1,
      cityDocumentCount: 1,
      phase1AuditItemCodes: auditCodes,
      approvedRules,
      pendingRuleCount: 0,
      pendingDraftCount: 0,
      openAlertCount: 0,
    })

    expect(r.isComplete).toBe(true)
    expect(r.statusLabel).toBe("完了")
  })
})
