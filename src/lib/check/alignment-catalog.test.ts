import { describe, expect, it } from "vitest"
import {
  BUILTIN_ALIGNMENT_CODES,
  mergeAiFindingsWithCatalog,
  pickCheckSetPrimaryId,
  runAlignmentCatalog,
  withBuiltinAlignmentRules,
} from "@/lib/check/alignment-catalog"
import type { ResolvedCheckRule } from "@/lib/rule-engine/resolve-check-rules"

describe("runAlignmentCatalog", () => {
  it("別ファイルの日付でもケアプラン更新より計画が古いと指摘する", () => {
    const findings = runAlignmentCatalog([
      "居宅サービス計画（ケアプラン）更新日：令和8年4月1日",
      "訪問介護計画書 作成日：令和8年1月10日",
    ])
    expect(findings.some((f) => f.title?.includes("追いついていない可能性"))).toBe(
      true
    )
  })

  it("セット内の時間重複・計画前提供・同意遅れも拾う", () => {
    const findings = runAlignmentCatalog([
      "居宅サービス計画（ケアプラン）更新日：令和8年4月1日",
      "訪問介護計画書 作成日：令和8年1月10日",
      "サービス提供日：令和7年12月1日 13:00～14:00",
      "日報 令和7年12月1日 13:30～14:30",
      "同意日：令和8年5月10日",
      "サービス開始日：令和8年5月1日",
    ])
    const titles = findings.map((f) => f.title ?? "")
    expect(titles.some((t) => t.includes("追いついていない"))).toBe(true)
    expect(titles.some((t) => t.includes("重なっている"))).toBe(true)
    expect(titles.some((t) => t.includes("計画の作成より前"))).toBe(true)
    expect(titles.some((t) => t.includes("同意日がサービス開始より後"))).toBe(
      true
    )
  })

  it("片方のファイルにしか日付が無いときは計画日付整合は未検証", () => {
    expect(
      runAlignmentCatalog(["ケアプラン更新日：令和8年4月1日"]).filter((f) =>
        f.title?.includes("追いついていない")
      )
    ).toHaveLength(0)
  })
})

describe("mergeAiFindingsWithCatalog", () => {
  it("カタログ指摘を先頭に置き、同じ観点のAI指摘は落とす", () => {
    const catalog = runAlignmentCatalog([
      "ケアプラン更新日：令和8年4月1日",
      "訪問介護計画書 作成日：令和7年12月1日",
    ])
    const merged = mergeAiFindingsWithCatalog(
      [
        { title: "同意欄をご確認ください", description: "空欄の可能性があります。" },
        {
          title: "計画の更新日をご確認ください",
          description: "追いついていない可能性があります。",
        },
      ],
      catalog
    )
    expect(merged[0]?.title).toBe(catalog[0]?.title)
    expect(merged.some((f) => f.title === "同意欄をご確認ください")).toBe(true)
    expect(
      merged.filter((f) => f.title?.includes("計画の更新日をご確認")).length
    ).toBe(0)
  })
})

describe("withBuiltinAlignmentRules", () => {
  it("標準観点を先頭に載せ、了承済みルールも残す", () => {
    const stub: ResolvedCheckRule = {
      versionId: "v-1",
      ruleId: "r-1",
      code: "HC_CUSTOM",
      title: "カスタム",
      versionNo: 1,
      guidanceText: "確認",
      severity: "mid",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      auditItemTitle: null,
      sourceTitle: null,
    }
    const merged = withBuiltinAlignmentRules([stub])
    expect(merged.map((r) => r.code)).toEqual(
      expect.arrayContaining([...Array.from(BUILTIN_ALIGNMENT_CODES), "HC_CUSTOM"])
    )
    expect(BUILTIN_ALIGNMENT_CODES.has(merged[0]?.code ?? "")).toBe(true)
  })
})

describe("pickCheckSetPrimaryId", () => {
  it("作成が早い書類を先頭にする", () => {
    expect(
      pickCheckSetPrimaryId([
        { id: "b", created_at: "2026-08-16T02:00:00.000Z" },
        { id: "a", created_at: "2026-08-16T01:00:00.000Z" },
      ])
    ).toBe("a")
  })
})
