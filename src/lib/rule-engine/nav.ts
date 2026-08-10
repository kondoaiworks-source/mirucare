import {
  Activity,
  Settings2,
  type LucideIcon,
} from "lucide-react"

export type RulesAdminNavItem = {
  href: string
  label: string
  description: string
  icon: LucideIcon
  /** アクティブ判定に使う追加パス（ハブ配下など） */
  matchPaths?: string[]
}

export type RulesAdminNavGroup = {
  id: string
  /** グループ見出し（省略時は見出しなし） */
  label?: string
  items: RulesAdminNavItem[]
}

/**
 * ルール設定サイドナビ（利用設定／監視状況の2本）。
 * @see docs/ルールブック構想.md
 */
export const RULES_ADMIN_NAV_GROUPS: RulesAdminNavGroup[] = [
  {
    id: "main",
    items: [
      {
        href: "/admin/rules/setup",
        label: "利用設定",
        description: "サービス設定 → カテゴリ／国県／自治体",
        icon: Settings2,
        matchPaths: [
          "/admin/rules/setup",
          "/admin/rules/services",
          "/admin/rules/pending",
          "/admin/rules/manual",
          "/admin/rules/history",
          "/admin/rules/regulatory",
          "/admin/rules/municipalities",
          "/admin/rules/audit-items",
          "/admin/rules/additions",
          "/admin/rules/ai-rules",
          "/admin/rules/ai",
          "/admin/rules/source-urls",
          "/admin/rules/laws",
        ],
      },
      {
        href: "/admin/rules/monitoring",
        label: "監視状況",
        description: "国・自治体の監視結果とエラーを確認する",
        icon: Activity,
        matchPaths: [
          "/admin/rules/monitoring",
          "/admin/rules/more",
          "/admin/rules/documents",
          "/admin/rules/jobs",
          "/admin/rules/notifications",
          "/admin/document-changes",
        ],
      },
    ],
  },
]

/** フラット一覧（後方互換・検索用） */
export const RULES_ADMIN_NAV: RulesAdminNavItem[] =
  RULES_ADMIN_NAV_GROUPS.flatMap((g) => g.items)

export function isNavItemActive(
  pathname: string,
  item: RulesAdminNavItem
): boolean {
  const paths = item.matchPaths?.length ? item.matchPaths : [item.href]

  return paths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}
