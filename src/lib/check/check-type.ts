/**
 * AI指摘の分類（書類同士の不整合 vs 適用ルール根拠）。
 * 推測で rule を付けない。判断できないときは未設定。
 */

export const FINDING_CHECK_TYPES = ["consistency", "rule"] as const

export type FindingCheckType = (typeof FINDING_CHECK_TYPES)[number]

/** 画面用。旧データは unset */
export type FindingCheckTypeFilter = FindingCheckType | "all" | "unset"

export type FindingComparisonItem = {
  source: string
  detail: string
}

export type FindingCheckMeta = {
  schemaVersion?: number
  comparison?: FindingComparisonItem[]
}

export function isFindingCheckType(value: unknown): value is FindingCheckType {
  return value === "consistency" || value === "rule"
}

export function parseFindingCheckType(raw: unknown): FindingCheckType | undefined {
  if (typeof raw !== "string") return undefined
  const v = raw.trim().toLowerCase()
  if (v === "consistency" || v === "整合" || v === "整合性") return "consistency"
  if (v === "rule" || v === "ルール" || v === "規則") return "rule"
  return undefined
}

/**
 * 保存・表示用の分類。誤分類を避ける。
 * - 明示された check_type を優先
 * - 書類同士カタログは consistency
 * - rule_code / rule_version_id があるときだけ rule と推定
 * - それ以外は未設定
 */
export function resolveFindingCheckType(input: {
  explicit?: unknown
  isAlignment?: boolean
  ruleCode?: string | null
  ruleVersionId?: string | null
}): FindingCheckType | null {
  if (input.isAlignment) return "consistency"
  const explicit = parseFindingCheckType(input.explicit)
  if (explicit) return explicit
  const code = input.ruleCode?.trim()
  const versionId = input.ruleVersionId?.trim()
  if (code || versionId) return "rule"
  return null
}

export function formatComparisonText(
  items: FindingComparisonItem[] | null | undefined
): string | undefined {
  if (!items || items.length === 0) return undefined
  const blocks = items
    .map((item) => {
      const source = item.source.trim()
      const detail = item.detail.trim()
      if (!source && !detail) return ""
      if (!detail) return source
      if (!source) return detail
      return `${source}\n${detail}`
    })
    .filter(Boolean)
  return blocks.length > 0 ? blocks.join("\n\n") : undefined
}

export function parseComparisonItems(raw: unknown): FindingComparisonItem[] {
  if (!Array.isArray(raw)) return []
  const out: FindingComparisonItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const obj = item as Record<string, unknown>
    const source = pickText(obj.source ?? obj.name ?? obj.label ?? obj.doc)
    const detail = pickText(
      obj.detail ?? obj.text ?? obj.value ?? obj.quote ?? obj.range
    )
    if (!source && !detail) continue
    out.push({ source: source || "比較対象", detail })
  }
  return out
}

function pickText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return ""
}

export function displayFindingCheckType(finding: {
  check_type?: string | null
  source_kind?: string | null
  rule_code?: string | null
  rule_version_id?: string | null
}): FindingCheckType | null {
  return resolveFindingCheckType({
    explicit: finding.check_type,
    isAlignment: finding.source_kind === "alignment",
    ruleCode: finding.rule_code,
    ruleVersionId: finding.rule_version_id,
  })
}

export function countFindingsByCheckType<
  T extends {
    check_type?: string | null
    source_kind?: string | null
    rule_code?: string | null
    rule_version_id?: string | null
  },
>(findings: T[]): { all: number; consistency: number; rule: number; unset: number } {
  let consistency = 0
  let rule = 0
  let unset = 0
  for (const f of findings) {
    const kind = displayFindingCheckType(f)
    if (kind === "consistency") consistency += 1
    else if (kind === "rule") rule += 1
    else unset += 1
  }
  return { all: findings.length, consistency, rule, unset }
}

export function filterFindingsByCheckType<
  T extends {
    check_type?: string | null
    source_kind?: string | null
    rule_code?: string | null
    rule_version_id?: string | null
  },
>(findings: T[], filter: FindingCheckTypeFilter): T[] {
  if (filter === "all") return findings
  if (filter === "unset") {
    return findings.filter((f) => displayFindingCheckType(f) == null)
  }
  return findings.filter((f) => displayFindingCheckType(f) === filter)
}
