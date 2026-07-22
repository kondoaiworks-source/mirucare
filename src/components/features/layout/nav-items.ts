import {
  LayoutDashboard,
  FileCheck2,
  Clock,
  Bell,
  BarChart3,
  GitCompareArrows,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  shortLabel: string
  icon: LucideIcon
}

/** PCサイドバー用（全項目） */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "ダッシュボード",
    shortLabel: "ホーム",
    icon: LayoutDashboard,
  },
  {
    href: "/documents",
    label: "日次作業",
    shortLabel: "日次",
    icon: FileCheck2,
  },
  {
    href: "/later",
    label: "あとで確認",
    shortLabel: "あとで",
    icon: Clock,
  },
  {
    href: "/reconcile",
    label: "月末の確認",
    shortLabel: "月末",
    icon: GitCompareArrows,
  },
  {
    href: "/alerts",
    label: "アラート",
    shortLabel: "期限",
    icon: Bell,
  },
  {
    href: "/reports",
    label: "月次レポート",
    shortLabel: "レポート",
    icon: BarChart3,
  },
  {
    href: "/settings",
    label: "設定",
    shortLabel: "設定",
    icon: Settings,
  },
]

/** モバイル下部タブ（押しやすさのため5項目） */
export const MOBILE_TAB_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => item.href !== "/reports" && item.href !== "/settings"
)

/** ヘッダーハンバーガーメニュー（モバイル） */
export const HEADER_MENU_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => item.href === "/reports" || item.href === "/settings"
)

/** デモ用のログイン事業所名（Auth連携後に差し替え） */
export const DEMO_FACILITY_NAME = "みらい訪問介護ステーション"
