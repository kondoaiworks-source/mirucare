import { describe, expect, it } from "vitest"
import {
  getPhase1ExpectedRules,
  hasDocumentEvidenceInCheckLogic,
} from "@/lib/rule-engine/phase1-rule-groups"
import { buildRulebookSetupReadiness } from "@/lib/rule-engine/rulebook-setup-readiness"

describe("buildRulebookSetupReadiness", () => {
  const emptyInput = {
    supportedMunicipalityCount: 0,
    nationalSourceUrlCount: 0,
    prefectureSourceUrlCount: 0,
    nationalDocumentCount: 0,
    prefectureDocumentCount: 0,
    cityRows: [],
    registeredAuditItemCodes: [],
    approvedRulesByCode: {},
    pendingVersionCount: 0,
    pendingKnowledgeDraftCount: 0,
    openSyncAlertCount: 0,
  }

  it("starts as 未着手 when nothing is configured", () => {
    const r = buildRulebookSetupReadiness(emptyInput)
    expect(r.statusLabel).toBe("未着手")
    expect(r.requiredDone).toBe(1)
    expect(r.phase1Checks).toHaveLength(4)
    expect(r.phase1Checks.every((c) => !c.done)).toBe(true)
  })

  it("marks phase1 check done when audit, rules, and evidence are complete", () => {
    const codes = getPhase1ExpectedRules().map((rule) => rule.code)
    const approvedRulesByCode = Object.fromEntries(
      codes.map((code) => [
        code,
        { hasApproved: true, hasEvidence: true },
      ])
    )
    const auditCodes = Array.from(
      new Set(getPhase1ExpectedRules().map((r) => r.auditItemCode))
    )

    const r = buildRulebookSetupReadiness({
      supportedMunicipalityCount: 5,
      nationalSourceUrlCount: 3,
      prefectureSourceUrlCount: 1,
      nationalDocumentCount: 2,
      prefectureDocumentCount: 1,
      cityRows: [
        {
          slug: "yokohama",
          name: "横浜市",
          sourceUrlCount: 2,
          documentCount: 1,
          auditItemCount: auditCodes.length,
          phase1AuditItemCodes: auditCodes,
        },
      ],
      registeredAuditItemCodes: auditCodes,
      approvedRulesByCode,
      pendingVersionCount: 0,
      pendingKnowledgeDraftCount: 0,
      openSyncAlertCount: 0,
    })

    expect(r.phase1Checks.every((c) => c.done)).toBe(true)
    expect(r.phase1RuleApproved).toBe(codes.length)
  })
})

describe("hasDocumentEvidenceInCheckLogic", () => {
  it("returns false for phase1 heuristic seed without evidence", () => {
    expect(
      hasDocumentEvidenceInCheckLogic({
        type: "heuristic",
        phase1: true,
        notes: "test",
      })
    ).toBe(false)
  })

  it("returns true when evidence summary is present", () => {
    expect(
      hasDocumentEvidenceInCheckLogic({
        type: "heuristic",
        evidence: { evidenceSummary: "厚労省マニュアル p.12" },
      })
    ).toBe(true)
  })
})
