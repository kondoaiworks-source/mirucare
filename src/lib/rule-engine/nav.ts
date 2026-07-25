import {
  Activity,
  Bell,
  BookOpen,
  History,
  Hourglass,
  LayoutDashboard,
  MapPin,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react"
import { getPurposeSection } from "@/lib/rule-engine/purpose-sections"

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

const rulebook = getPurposeSection("rulebook")

/**
 * ルールブック構想に沿ったサイドナビ。
 * @see docs/ルールブック構想.md
 */
export const RULES_ADMIN_NAV_GROUPS: RulesAdminNavGroup[] = [
  {
    id: "home",
    items: [
      {
        href: "/admin/rules",
        label: "ホーム",
        description: "準備状況と更新アラート",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: "rulebook",
    label: "ルールブック",
    items: [
      {
        href: rulebook?.href ?? "/admin/rules/regulatory",
        label: "ルールブック設定",
        description:
          rulebook?.navDescription ?? "参照URL・資料を整え確定版を保つ",
        icon: BookOpen,
        matchPaths: rulebook?.matchPaths,
      },
    ],
  },
  {
    id: "review",
    label: "確認する",
    items: [
      {
        href: "/admin/rules/pending",
        label: "承認待ち",
        description: "人がOKするまで本番に載せない",
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
    id: "ops",
    label: "運用",
    items: [
      {
        href: "/admin/rules/municipalities",
        label: "自治体マスタ",
        description: "国・県・市の対応設定",
        icon: MapPin,
      },
      {
        href: "/admin/rules/notifications",
        label: "通知一覧",
        description: "更新アラートなどの通知履歴",
        icon: Bell,
      },
      {
        href: "/admin/rules/jobs",
        label: "運用監視",
        description: "同期・監視の実行状況",
        icon: Activity,
      },
    ],
  },
  {
    id: "more",
    items: [
      {
        href: "/admin/rules/more",
        label: "詳細設定",
        description: "監査項目・判定ルール・加算など",
        icon: MoreHorizontal,
        matchPaths: [
          "/admin/rules/more",
          "/admin/rules/additions",
          "/admin/rules/audit-items",
          "/admin/rules/ai-rules",
          "/admin/rules/ai",
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
