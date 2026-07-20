import {
  LayoutDashboard,
  BookOpen,
  MapPin,
  ClipboardList,
  Bot,
  Coins,
  History,
  Hourglass,
  Bell,
  Activity,
  type LucideIcon,
} from "lucide-react"

export type RulesAdminNavItem = {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

/** マスタールールエンジン管理のサイドナビ */
export const RULES_ADMIN_NAV: RulesAdminNavItem[] = [
  {
    href: "/admin/rules",
    label: "ダッシュボード",
    description: "件数サマリと要対応",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/rules/laws",
    label: "法令管理",
    description: "法令・通知・マニュアル根拠",
    icon: BookOpen,
  },
  {
    href: "/admin/rules/municipalities",
    label: "自治体管理",
    description: "国・都道府県・市区町村",
    icon: MapPin,
  },
  {
    href: "/admin/rules/audit-items",
    label: "監査項目管理",
    description: "監査官視点の確認項目",
    icon: ClipboardList,
  },
  {
    href: "/admin/rules/ai-rules",
    label: "AIルール管理",
    description: "判定ルールと版",
    icon: Bot,
  },
  {
    href: "/admin/rules/additions",
    label: "加算管理",
    description: "カテゴリ「加算」の項目",
    icon: Coins,
  },
  {
    href: "/admin/rules/history",
    label: "更新履歴",
    description: "ルール版の変更履歴",
    icon: History,
  },
  {
    href: "/admin/rules/pending",
    label: "承認待ち",
    description: "判定ルール版の承認",
    icon: Hourglass,
  },
  {
    href: "/admin/rules/notifications",
    label: "通知一覧",
    description: "マニュアル変更の通知状況",
    icon: Bell,
  },
  {
    href: "/admin/rules/jobs",
    label: "ジョブ監視",
    description: "同期・監視の実行状況",
    icon: Activity,
  },
]
