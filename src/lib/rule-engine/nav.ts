import {
  Bell,
  BookOpen,
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
 * 入口はルールブック管理。詳細・運用監視は日常外。
 * @see docs/ルールブック構想.md
 */
export const RULES_ADMIN_NAV_GROUPS: RulesAdminNavGroup[] = [
  {
    id: "rulebook",
    items: [
      {
        href: "/admin/rules/regulatory",
        label: "ルールブック管理",
        description: "地域ごとのルール集（ルールブック）を整える",
        icon: BookOpen,
        matchPaths: [
          "/admin/rules/regulatory",
          "/admin/document-changes",
        ],
      },
      {
        href: "/admin/rules/pending",
        label: "ルール管理",
        description:
          "チェック用ルールの了承・差し戻しと更新履歴",
        icon: Hourglass,
        matchPaths: ["/admin/rules/pending", "/admin/rules/history"],
      },
      {
        href: "/admin/rules/notifications",
        label: "公開情報台帳管理",
        description:
          "公開情報の変更を感知し、台帳反映の承認を依頼する",
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
        description: "同期結果の確認・公開情報監視（通常は触らない）",
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
