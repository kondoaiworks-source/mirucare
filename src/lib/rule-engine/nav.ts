import {
  Bell,
  BookOpen,
  History,
  Hourglass,
  MapPin,
  MoreHorizontal,
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
 * ルール設定サイドナビ（ホームなし）。
 * 入口はルールブック設定。詳細・運用監視は日常外。
 * @see docs/ルールブック構想.md
 */
export const RULES_ADMIN_NAV_GROUPS: RulesAdminNavGroup[] = [
  {
    id: "rulebook",
    label: "ルールブック設定",
    items: [
      {
        href: "/admin/rules/regulatory",
        label: "ルールブック設定",
        description: "この自治体で従う確定版を整える",
        icon: BookOpen,
        matchPaths: [
          "/admin/rules/regulatory",
          "/admin/rules/laws",
          "/admin/document-changes",
        ],
      },
      {
        href: "/admin/rules/pending",
        label: "新ルール判定通知",
        description:
          "自治体ルールからAIが生成したチェックルールを確認して反映",
        icon: Hourglass,
      },
      {
        href: "/admin/rules/history",
        label: "更新履歴",
        description: "いつの版に変わったか",
        icon: History,
      },
      {
        href: "/admin/rules/notifications",
        label: "自治体ルール変更通知",
        description:
          "自治体ルールの変更を感知して差分承認の依頼を通知",
        icon: Bell,
      },
    ],
  },
  {
    id: "municipality",
    label: "自治体管理",
    items: [
      {
        href: "/admin/rules/municipalities",
        label: "自治体マスタ",
        description: "国・県・市の対応設定",
        icon: MapPin,
      },
    ],
  },
  {
    id: "more",
    label: "監視トラブル",
    items: [
      {
        href: "/admin/rules/more",
        label: "監視トラブル",
        description: "行政資料台帳・同期の結果（通常は触らない）",
        icon: MoreHorizontal,
        matchPaths: [
          "/admin/rules/more",
          "/admin/rules/documents",
          "/admin/rules/jobs",
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
