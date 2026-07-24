/**
 * 監査結果向けの機械的匿名化（結果DB・画面）
 * 完全な人名検出ではないが、ラベル付き氏名・電話・メール・被保険者番号などを置換する。
 */

export type AnonymizeResult = {
  text: string
  replacedLabels: string[]
}

type SlotKind = "client" | "staff" | "other"

type NameMaps = {
  client: Map<string, string>
  staff: Map<string, string>
  other: Map<string, string>
}

function emptyMaps(): NameMaps {
  return {
    client: new Map(),
    staff: new Map(),
    other: new Map(),
  }
}

function labelFor(kind: SlotKind, index: number): string {
  const letter = String.fromCharCode(65 + ((index - 1) % 26))
  if (kind === "client") return `利用者${letter}`
  if (kind === "staff") return `職員${letter}`
  return `関係者${letter}`
}

function looksLikePersonName(raw: string): boolean {
  const s = raw.trim()
  if (s.length < 2 || s.length > 12) return false
  if (!/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF々〆ヵヶー・\s]+$/.test(s)) {
    return false
  }
  if (/^(都|道|府|県|市|区|町|村)$/.test(s)) return false
  // すでに匿名ラベル
  if (/^(利用者|職員|関係者)[A-Z]$/.test(s)) return false
  return true
}

function assignName(maps: NameMaps, kind: SlotKind, name: string): string {
  const key = name.replace(/\s+/g, "")
  const map = maps[kind]
  const existing = map.get(key)
  if (existing) return existing
  const label = labelFor(kind, map.size + 1)
  map.set(key, label)
  return label
}

function anonymizeWithMaps(input: string, maps: NameMaps): string {
  if (!input) return input

  let text = input

  text = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[メール]"
  )
  text = text.replace(
    /(?<!\d)0\d{1,4}[-−ー]?\d{1,4}[-−ー]?\d{3,4}(?!\d)/g,
    "[電話番号]"
  )
  // 被保険者番号を郵便番号より先に（数字列の誤検知防止）
  text = text.replace(
    /(?:被保険者(?:番号)?|保険者番号|証番号)[：:\s]*([0-9０-９]{8,12})/g,
    (full, num: string) => full.replace(num, "[被保険者番号]")
  )
  text = text.replace(/〒\s*\d{3}[-−ー]?\d{4}|(?<!\d)\d{3}[-−ー]\d{4}(?!\d)/g, "[郵便番号]")

  const labeled =
    /((?:利用者|ご利用者|顧客|対象者|家族|保護者|本人)(?:名|氏名)?|(?:氏名|お名前|名前)|(?:担当ヘルパー|訪問介護員|介護職員|サービス提供責任者|サ責|ヘルパー|担当|職員)(?:名|氏名)?)[：:\s]*([^\s、。，,\n]{2,12})/g

  text = text.replace(labeled, (full, label: string, name: string) => {
    if (!looksLikePersonName(name)) return full
    const isStaff =
      /担当ヘルパー|訪問介護員|介護職員|サービス提供責任者|サ責|ヘルパー|担当|職員/.test(
        label
      )
    const kind: SlotKind = isStaff ? "staff" : "client"
    const anon = assignName(maps, kind, name)
    const sep = /[：:]/.test(full) ? "：" : " "
    return `${label}${sep}${anon}`
  })

  text = text.replace(
    /([\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]{2,4})様/g,
    (_full, name: string) => {
      if (!looksLikePersonName(name)) return `${name}様`
      return `${assignName(maps, "client", name)}様`
    }
  )

  return text
}

/**
 * 1本の文字列を匿名化。同一入力内では同じ氏名→同じラベルに揃える。
 */
export function anonymizeText(input: string): AnonymizeResult {
  const maps = emptyMaps()
  const text = anonymizeWithMaps(input, maps)
  const replacedLabels = [
    ...Array.from(maps.client.values()),
    ...Array.from(maps.staff.values()),
    ...Array.from(maps.other.values()),
  ]
  return { text, replacedLabels }
}

/** 指摘フィールド一式をまとめて匿名化（同一指摘内でラベルを共有） */
export function anonymizeFindingFields(fields: {
  title: string
  description: string
  basis: string | null
  suggestion: string | null
}): {
  title: string
  description: string
  basis: string | null
  suggestion: string | null
} {
  const maps = emptyMaps()
  const sep = "\n<<<SPLIT>>>\n"
  const joined = [
    fields.title,
    fields.description,
    fields.basis ?? "",
    fields.suggestion ?? "",
  ].join(sep)
  const shared = anonymizeWithMaps(joined, maps)
  const parts = shared.split(sep)

  return {
    title: (parts[0] ?? "").slice(0, 200),
    description: (parts[1] ?? "").slice(0, 4000),
    basis: parts[2] ? parts[2].slice(0, 1000) : null,
    suggestion: parts[3] ? parts[3].slice(0, 4000) : null,
  }
}
