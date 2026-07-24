import { describe, expect, it } from "vitest"
import {
  anonymizeFindingFields,
  anonymizeText,
} from "@/lib/privacy/anonymize"

describe("anonymizeText", () => {
  it("ラベル付き利用者名を利用者Aに置換する", () => {
    const { text, replacedLabels } = anonymizeText(
      "利用者名：山田太郎 の計画をご確認ください。"
    )
    expect(text).toContain("利用者A")
    expect(text).not.toContain("山田太郎")
    expect(replacedLabels).toContain("利用者A")
  })

  it("同一氏名は同一ラベルになる", () => {
    const { text } = anonymizeText(
      "利用者名：佐藤花子。のち佐藤花子様の記録。"
    )
    expect(text.match(/利用者A/g)?.length).toBeGreaterThanOrEqual(2)
    expect(text).not.toContain("佐藤花子")
  })

  it("職員名は職員Aになる", () => {
    const { text } = anonymizeText("担当ヘルパー：鈴木一郎 が訪問しています。")
    expect(text).toContain("職員A")
    expect(text).not.toContain("鈴木一郎")
  })

  it("電話・メール・郵便番号をマスクする", () => {
    const { text } = anonymizeText(
      "連絡先 090-1234-5678 / test@example.com / 〒123-4567"
    )
    expect(text).toContain("[電話番号]")
    expect(text).toContain("[メール]")
    expect(text).toContain("[郵便番号]")
    expect(text).not.toContain("090-1234-5678")
    expect(text).not.toContain("test@example.com")
  })

  it("被保険者番号をマスクする", () => {
    const { text } = anonymizeText("被保険者番号：1234567890 です。")
    expect(text).toContain("[被保険者番号]")
    expect(text).not.toContain("1234567890")
  })
})

describe("anonymizeFindingFields", () => {
  it("フィールド横断で同じ氏名を同じラベルにする", () => {
    const result = anonymizeFindingFields({
      title: "利用者名：田中一郎 の確認",
      description: "田中一郎様の提供記録をご確認ください。",
      basis: null,
      suggestion: "氏名：田中一郎 の欄をご確認ください。",
    })
    expect(result.title).toContain("利用者A")
    expect(result.description).toContain("利用者A")
    expect(result.suggestion).toContain("利用者A")
    expect(result.title + result.description + result.suggestion).not.toContain(
      "田中一郎"
    )
  })
})
