import {
  Bell,
  ClipboardList,
  Hourglass,
  Layers,
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
 * ルール設定サイドナビ。
 * 入口は介護サービス選定。了承は横断キューも残す。
 * @see docs/ルールブック構想.md
 */
export const RULES_ADMIN_NAV_GROUPS: RulesAdminNavGroup[] = [
  {
    id: "setup",
    items: [
      {
        href: "/admin/rules/services",
        label: "介護サービス選定",
        description:
          "サービスを選び、国・県・市区町村・監査カテゴリを整える",
        icon: Layers,
        matchPaths: [
          "/admin/rules/services",
          "/admin/rules/regulatory",
          "/admin/rules/municipalities",
        ],
      },
      {
        href: "/admin/rules/pending",
        label: "ルール管理",
        description:
          "チェック用ルールの生成・了承・差し戻しと更新履歴（横断キュー）",
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
      {
        href: "/admin/rules/audit-items",
        label: "監査項目（詳細）",
        description: "テンプレ監査項目の一覧・編集（日常外）",
        icon: ClipboardList,
        matchPaths: ["/admin/rules/audit-items", "/admin/rules/additions"],
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
