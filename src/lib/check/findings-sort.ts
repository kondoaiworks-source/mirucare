import type { Finding, FindingStatus } from "@/types/database"

const STATUS_ORDER: Record<FindingStatus, number> = {
  open: 0,
  later: 1,
  dismissed: 2,
  fixed: 3,
}

const SEVERITY_ORDER = { high: 0, mid: 1, low: 2 } as const

/**
 * これから確認 → あとで確認 → 違う指摘 → 対応した
 * 同一ステータス内は重要度順
 */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const statusDiff =
      (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
    if (statusDiff !== 0) return statusDiff
    const sevDiff =
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    if (sevDiff !== 0) return sevDiff
    return a.sort_order - b.sort_order
  })
}

export function groupFindingsByStatus(findings: Finding[]): {
  open: Finding[]
  later: Finding[]
  dismissed: Finding[]
  fixed: Finding[]
} {
  const sorted = sortFindings(findings)
  return {
    open: sorted.filter((f) => f.status === "open"),
    later: sorted.filter((f) => f.status === "later"),
    dismissed: sorted.filter((f) => f.status === "dismissed"),
    fixed: sorted.filter((f) => f.status === "fixed"),
  }
}

export function isFindingAddressed(status: FindingStatus): boolean {
  return status === "fixed" || status === "dismissed"
}

export function isFindingStillPending(status: FindingStatus): boolean {
  return status === "open" || status === "later"
}
