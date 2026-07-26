import {
  ClipboardCheck,
  Clock,
  History,
  Settings,
  Scale,
  Building2,
  BookOpen,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  shortLabel: string
  icon: LucideIcon
  /** プレースホルダ（第2フェーズ） */
  comingSoon?: boolean
}

/** PCサイドバー（お知らせは運用AI監査内。運用AIは `/` に集約） */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "運用AI監査",
    shortLabel: "運用",
    icon: ClipboardCheck,
  },
  {
    href: "/later",
    label: "あとで確認",
    shortLabel: "あとで",
    icon: Clock,
  },
  {
    href: "/audit-history",
    label: "監査結果",
    shortLabel: "結果",
    icon: History,
  },
  {
    href: "/audit/legal",
    label: "法令AI監査",
    shortLabel: "法令",
    icon: Scale,
    comingSoon: true,
  },
  {
    href: "/audit/management",
    label: "運営AI監査",
    shortLabel: "運営",
    icon: Building2,
    comingSoon: true,
  },
  {
    href: "/settings",
    label: "設定",
    shortLabel: "設定",
    icon: Settings,
  },
]

/** モバイル下部タブ：運用AI・あとで・履歴・設定 */
export const MOBILE_TAB_ITEMS: NavItem[] = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  NAV_ITEMS[2],
  NAV_ITEMS[5],
]

/** ヘッダーハンバーガー：使い方（事業所設定は「設定」内） */
export const HEADER_MENU_ITEMS: NavItem[] = [
  {
    href: "/guide",
    label: "使い方",
    shortLabel: "使い方",
    icon: BookOpen,
  },
]

/** デモ用のログイン事業所名（Auth連携後に差し替え） */
export const DEMO_FACILITY_NAME = "みらい訪問介護ステーション"

/** サイドバー／タブのアクティブ判定 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return (
      pathname === "/" ||
      pathname.startsWith("/audit/operations") ||
      pathname.startsWith("/check/upload")
    )
  }
  if (href === "/audit-history") {
    // 結果画面 `/check/[id]` のみ。アップロード `/check/upload` は運用AI監査側
    if (pathname.startsWith("/check/upload")) return false
    return (
      pathname.startsWith("/audit-history") ||
      pathname.startsWith("/documents") ||
      pathname.startsWith("/check/")
    )
  }
  return pathname.startsWith(href)
}
