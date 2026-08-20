import { describe, expect, it } from "vitest"
import {
  resolveApprovedRulesForCheck,
  serializeRegulatoryBasisForDify,
  serializeRulesForDify,
  toAppliedRulesSnapshot,
  type CheckRulesResolution,
} from "@/lib/rule-engine/resolve-check-rules"

describe("resolve-check-rules serializers", () => {
  const sample: CheckRulesResolution = {
    asOf: "2026-07-22",
    truncated: false,
    rules: [
      {
        versionId: "v1",
        ruleId: "r1",
        code: "HC_PLAN_01",
        title: "計画と実態の整合",
        versionNo: 2,
        guidanceText: "計画外サービスに読める記載がないかご確認ください。",
        severity: "high",
        effectiveFrom: "2026-04-01",
        effectiveTo: null,
        auditItemTitle: "訪問介護計画",
        sourceTitle: null,
      },
    ],
    regulatoryBasis: [
      {
        id: "k1",
        title: "集団指導資料",
        year: 2026,
        regionName: "横浜市",
        jurisdictionLevel: "municipality",
      },
    ],
  }

  it("Dify向けJSONにコードと版を含める", () => {
    const json = serializeRulesForDify(sample.rules)
    expect(json).toContain("HC_PLAN_01")
    expect(json).toContain("version_no")
    expect(json).toContain("v1")
    expect(json).toContain("guidance_truncated")
  })

  it("行政根拠JSONにタイトルを含める", () => {
    const json = serializeRegulatoryBasisForDify(sample.regulatoryBasis)
    expect(json).toContain("集団指導資料")
    expect(json).toContain("横浜市")
  })

  it("スナップショットに基準日と件数を残す", () => {
    const snap = toAppliedRulesSnapshot(sample)
    expect(snap.asOf).toBe("2026-07-22")
    expect(snap.ruleCount).toBe(1)
    expect(snap.rules[0]?.versionNo).toBe(2)
  })
})

describe("resolveApprovedRulesForCheck", () => {
  function mockAdmin() {
    const tables: Record<string, unknown[]> = {
      ai_check_rules: [
        {
          id: "r-bcp",
          code: "HC_BCP_INFECTION",
          title: "感染症BCPの確認",
          target_doc_types: ["その他"],
          status: "active",
          audit_item_id: "a-bcp",
          scope_kind: "shared",
          jurisdiction_id: null,
          audit_items: {
            id: "a-bcp",
            title: "感染症BCP",
            source_id: null,
            status: "active",
          },
        },
        {
          id: "r-plan",
          code: "HC_PLAN_CONSENT",
          title: "計画同意の確認",
          target_doc_types: ["ケアプラン"],
          status: "active",
          audit_item_id: "a-plan",
          scope_kind: "shared",
          jurisdiction_id: null,
          audit_items: {
            id: "a-plan",
            title: "計画同意",
            source_id: null,
            status: "active",
          },
        },
      ],
      ai_check_rule_versions: [
        {
          id: "v-bcp",
          rule_id: "r-bcp",
          version_no: 1,
          guidance_text:
            "感染症BCP・研修記録・訓練記録で、整備や周知が不足している可能性がないかご確認ください。",
          severity: "mid",
          effective_from: "2026-01-01",
          effective_to: null,
          review_status: "approved",
          change_summary: "頻出観点の初期シード",
          check_logic: { type: "heuristic" },
          knowledge_document_change_drafts: null,
        },
        {
          id: "v-plan",
          rule_id: "r-plan",
          version_no: 1,
          guidance_text:
            "計画書への同意・署名が不足している可能性がないかご確認ください。",
          severity: "high",
          effective_from: "2026-01-01",
          effective_to: null,
          review_status: "approved",
          change_summary: "頻出観点の初期シード",
          check_logic: { type: "heuristic" },
          knowledge_document_change_drafts: null,
        },
      ],
      rule_jurisdictions: [{ id: "jid-yokohama", code: "JP-14-14100" }],
      knowledge_documents: [],
    }

    return {
      from(table: string) {
        let rows = [...(tables[table] ?? [])] as Array<Record<string, unknown>>
        const api = {
          select() {
            return api
          },
          eq(column: string, value: unknown) {
            rows = rows.filter((r) => r[column] === value)
            return api
          },
          in(column: string, values: unknown[]) {
            rows = rows.filter((r) => values.includes(r[column]))
            return api
          },
          or() {
            return api
          },
          order() {
            return api
          },
          limit() {
            return Promise.resolve({ data: rows, error: null })
          },
          maybeSingle() {
            return Promise.resolve({ data: rows[0] ?? null, error: null })
          },
        }
        return api
      },
    }
  }

  it("includes approved frequent-guidance rules beyond Phase1 by default", async () => {
    const resolution = await resolveApprovedRulesForCheck(mockAdmin(), {
      municipality: "横浜市",
      docType: "その他",
      asOf: "2026-08-19",
    })
    expect(resolution.rules.map((r) => r.code)).toContain("HC_BCP_INFECTION")
  })

  it("does not filter approved rules by target_doc_types", async () => {
    const resolution = await resolveApprovedRulesForCheck(mockAdmin(), {
      municipality: "横浜市",
      docType: "提供記録",
      asOf: "2026-08-19",
    })
    const codes = resolution.rules.map((r) => r.code)
    expect(codes).toContain("HC_BCP_INFECTION")
    expect(codes).toContain("HC_PLAN_CONSENT")
  })

  it("can still narrow to the old Phase1 checks when requested", async () => {
    const resolution = await resolveApprovedRulesForCheck(mockAdmin(), {
      municipality: "横浜市",
      docType: "その他",
      asOf: "2026-08-19",
      phase1Only: true,
    })
    expect(resolution.rules.map((r) => r.code)).not.toContain(
      "HC_BCP_INFECTION"
    )
  })
})
