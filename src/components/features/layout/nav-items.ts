import {
  LayoutDashboard,
  FileCheck2,
  Clock,
  Bell,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  shortLabel: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "ダッシュボード",
    shortLabel: "ホーム",
    icon: LayoutDashboard,
  },
  {
    href: "/documents",
    label: "書類チェック",
    shortLabel: "チェック",
    icon: FileCheck2,
  },
  {
    href: "/later",
    label: "あとで確認",
    shortLabel: "あとで",
    icon: Clock,
  },
  {
    href: "/alerts",
    label: "アラート",
    shortLabel: "アラート",
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

/** デモ用のログイン事業所名（Auth連携後に差し替え） */
export const DEMO_FACILITY_NAME = "みらい訪問介護ステーション"
