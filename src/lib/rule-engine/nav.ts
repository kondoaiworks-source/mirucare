import {
  History,
  Hourglass,
  LayoutDashboard,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react"
import { PURPOSE_SECTIONS } from "@/lib/rule-engine/purpose-sections"

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
 * シンプル化したサイドナビ（主要6＋その他）。
 * 加算・ジョブ・通知などは /admin/rules/more へ。
 */
export const RULES_ADMIN_NAV_GROUPS: RulesAdminNavGroup[] = [
  {
    id: "home",
    items: [
      {
        href: "/admin/rules",
        label: "ホーム",
        description: "準備状況と次にやること",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: "main",
    label: "設定する",
    items: PURPOSE_SECTIONS.map((section) => ({
      href: section.href,
      label: section.label,
      description: section.navDescription,
      icon: section.icon,
      matchPaths: section.matchPaths.filter(
        // 承認待ちは別メニューなので AI のハイライトから外す
        (p) => p !== "/admin/rules/pending"
      ),
    })),
  },
  {
    id: "review",
    label: "確認する",
    items: [
      {
        href: "/admin/rules/pending",
        label: "承認待ち",
        description: "ルール版を本番に載せる前の確認",
        icon: Hourglass,
      },
      {
        href: "/admin/rules/history",
        label: "更新履歴",
        description: "いつの版に変わったか",
        icon: History,
      },
    ],
  },
  {
    id: "more",
    items: [
      {
        href: "/admin/rules/more",
        label: "その他の設定",
        description: "加算・自治体・ジョブなど",
        icon: MoreHorizontal,
        matchPaths: [
          "/admin/rules/more",
          "/admin/rules/additions",
          "/admin/rules/municipalities",
          "/admin/rules/jobs",
          "/admin/rules/notifications",
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
  if (item.href === "/admin/rules") {
    return pathname === "/admin/rules"
  }

  const paths = item.matchPaths?.length ? item.matchPaths : [item.href]

  return paths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}