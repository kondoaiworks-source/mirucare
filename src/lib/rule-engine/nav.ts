import {
  LayoutDashboard,
  MapPin,
  History,
  Hourglass,
  Bell,
  Activity,
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

/** 目的別サイドナビ（グループ構成） */
export const RULES_ADMIN_NAV_GROUPS: RulesAdminNavGroup[] = [
  {
    id: "home",
    items: [
      {
        href: "/admin/rules",
        label: "ホーム",
        description: "全体の状況と入口",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: "purpose",
    label: "目的から選ぶ",
    items: PURPOSE_SECTIONS.map((section) => ({
      href: section.href,
      label: section.label,
      description: section.navDescription,
      icon: section.icon,
      matchPaths: section.matchPaths,
    })),
  },
  {
    id: "ops",
    label: "運用サポート",
    items: [
      {
        href: "/admin/rules/pending",
        label: "承認待ち",
        description: "判定ルール版の承認",
        icon: Hourglass,
      },
      {
        href: "/admin/rules/history",
        label: "更新履歴",
        description: "ルール版の変更履歴",
        icon: History,
      },
      {
        href: "/admin/rules/notifications",
        label: "通知一覧",
        description: "マニュアル変更の通知",
        icon: Bell,
      },
      {
        href: "/admin/rules/jobs",
        label: "ジョブ監視",
        description: "同期・監視の実行状況",
        icon: Activity,
      },
      {
        href: "/admin/rules/municipalities",
        label: "自治体マスタ",
        description: "国・都道府県・市区町村",
        icon: MapPin,
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

  const paths = item.matchPaths?.length
    ? item.matchPaths
    : [item.href]

  return paths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}
