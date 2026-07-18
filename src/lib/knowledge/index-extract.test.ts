import { describe, expect, it } from "vitest"
import {
  extractWatchRows,
  itemKeyForRow,
  normalizeWatchText,
  normalizeWatchUrl,
} from "./index-extract"

describe("normalizeWatchUrl", () => {
  it("相対パスを絶対化しセッション系クエリを落とす", () => {
    const out = normalizeWatchUrl(
      "/news/1.pdf?sid=abc&utm_source=x&keep=1",
      "https://example.go.jp/list/"
    )
    expect(out).toBe("https://example.go.jp/news/1.pdf?keep=1")
  })
})

describe("normalizeWatchText", () => {
  it("空白を正規化する", () => {
    expect(normalizeWatchText("  a\n\tb  ")).toBe("a b")
  })
})

describe("extractWatchRows", () => {
  const html = `
    <ul class="list">
      <li class="item"><a href="/a.pdf">記事A</a></li>
      <li class="item"><a href="/b.pdf">記事B</a></li>
    </ul>
  `

  it("セレクタで行を抽出し item_key を付与する", () => {
    const rows = extractWatchRows(
      html,
      "ul.list li.item",
      "https://example.go.jp/"
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.title).toBe("記事A")
    expect(rows[0]?.href).toBe("https://example.go.jp/a.pdf")
    expect(rows[0]?.item_key).toBe(
      itemKeyForRow("記事A", "https://example.go.jp/a.pdf")
    )
  })

  it("抽出0件は空配列（呼び出し側でセレクタ破損扱い）", () => {
    const rows = extractWatchRows(html, "ul.list li.missing", "https://example.go.jp/")
    expect(rows).toEqual([])
  })

  it("並びが変わっても item_key は不変", () => {
    const reversed = `
      <ul class="list">
        <li class="item"><a href="/b.pdf">記事B</a></li>
        <li class="item"><a href="/a.pdf">記事A</a></li>
      </ul>
    `
    const a = extractWatchRows(html, "ul.list li.item", "https://example.go.jp/")
    const b = extractWatchRows(
      reversed,
      "ul.list li.item",
      "https://example.go.jp/"
    )
    const keysA = new Set(a.map((r) => r.item_key))
    const keysB = new Set(b.map((r) => r.item_key))
    expect(keysA).toEqual(keysB)
  })
})
