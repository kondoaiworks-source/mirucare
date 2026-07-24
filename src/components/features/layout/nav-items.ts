import {
  LayoutDashboard,
  Clock,
  Bell,
  History,
  Settings,
  ClipboardCheck,
  Scale,
  Building2,
  SlidersHorizontal,
  Upload,
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

/** PCサイドバー用（施設向け Phase1 IA） */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "ホーム",
    shortLabel: "ホーム",
    icon: LayoutDashboard,
  },
  {
    href: "/later",
    label: "あとで確認",
    shortLabel: "あとで",
    icon: Clock,
  },
  {
    href: "/announcements",
    label: "ルールブック更新お知らせ",
    shortLabel: "お知らせ",
    icon: Bell,
  },
  {
    href: "/audit-history",
    label: "監査結果の履歴",
    shortLabel: "履歴",
    icon: History,
  },
  {
    href: "/audit/operations",
    label: "運用AI監査",
    shortLabel: "運用",
    icon: ClipboardCheck,
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
    href: "/setup",
    label: "初期設定",
    shortLabel: "初期設定",
    icon: SlidersHorizontal,
  },
  {
    href: "/settings",
    label: "設定",
    shortLabel: "設定",
    icon: Settings,
  },
]

/** モバイル下部タブ（押しやすさのため主要5項目） */
export const MOBILE_TAB_ITEMS: NavItem[] = [
  NAV_ITEMS[0], // ホーム
  NAV_ITEMS[1], // あとで
  NAV_ITEMS[4], // 運用AI
  NAV_ITEMS[3], // 履歴
  NAV_ITEMS[2], // お知らせ
]

/** ヘッダーハンバーガー（初期設定・アップロード・設定） */
export const HEADER_MENU_ITEMS: NavItem[] = [
  {
    href: "/setup",
    label: "初期設定",
    shortLabel: "初期設定",
    icon: SlidersHorizontal,
  },
  {
    href: "/check/upload",
    label: "監査書類アップロード",
    shortLabel: "アップロード",
    icon: Upload,
  },
  {
    href: "/settings",
    label: "設定",
    shortLabel: "設定",
    icon: Settings,
  },
]

/** デモ用のログイン事業所名（Auth連携後に差し替え） */
export const DEMO_FACILITY_NAME = "みらい訪問介護ステーション"

/** サイドバー／タブのアクティブ判定 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  if (href === "/audit-history") {
    return (
      pathname.startsWith("/audit-history") ||
      pathname.startsWith("/documents") ||
      pathname.startsWith("/check/")
    )
  }
  if (href === "/audit/operations") {
    return (
      pathname.startsWith("/audit/operations") ||
      pathname.startsWith("/check/upload")
    )
  }
  if (href === "/check/upload") {
    return pathname.startsWith("/check/upload")
  }
  return pathname.startsWith(href)
}
