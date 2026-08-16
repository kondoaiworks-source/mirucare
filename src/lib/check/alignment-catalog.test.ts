import { describe, expect, it } from "vitest"
import {
  mergeAiFindingsWithCatalog,
  pickCheckSetPrimaryId,
  runAlignmentCatalog,
} from "@/lib/check/alignment-catalog"

describe("runAlignmentCatalog", () => {
  it("別ファイルの日付でもケアプラン更新より計画が古いと指摘する", () => {
    const findings = runAlignmentCatalog([
      "居宅サービス計画（ケアプラン）更新日：令和8年4月1日",
      "訪問介護計画書 作成日：令和8年1月10日",
    ])
    expect(findings).toHaveLength(1)
    expect(findings[0]?.title).toContain("追いついていない可能性")
  })

  it("片方のファイルにしか日付が無いときは未検証", () => {
    expect(
      runAlignmentCatalog(["ケアプラン更新日：令和8年4月1日"])
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
    expect(merged).toHaveLength(2)
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
