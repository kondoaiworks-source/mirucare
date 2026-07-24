import {
  Activity,
  Bell,
  Bot,
  ClipboardCheck,
  Coins,
  FileText,
  Link2,
  MapPin,
  Scale,
  type LucideIcon,
} from "lucide-react"

/** サイドナビに出さない・「その他」にまとめるリンク */
export type RulesMoreLink = {
  href: string
  label: string
  description: string
  icon: LucideIcon
  group: "optional" | "master" | "ops"
}

export const RULES_MORE_LINKS: RulesMoreLink[] = [
  {
    href: "/admin/rules/additions",
    label: "加算設定",
    description: "加算の算定条件・必要書類（任意）",
    icon: Coins,
    group: "optional",
  },
  {
    href: "/admin/rules/municipalities",
    label: "自治体マスタ",
    description: "国・都道府県・市区町村の対応設定",
    icon: MapPin,
    group: "master",
  },
  {
    href: "/admin/rules/documents",
    label: "行政資料（台帳）",
    description: "マニュアルPDF・監視設定の詳細",
    icon: FileText,
    group: "master",
  },
  {
    href: "/admin/rules/laws",
    label: "法令・根拠",
    description: "法令・通知のメタ情報",
    icon: Scale,
    group: "master",
  },
  {
    href: "/admin/rules/source-urls",
    label: "参照サイト",
    description: "厚労省・自治体などの原文URL",
    icon: Link2,
    group: "master",
  },
  {
    href: "/admin/rules/ai",
    label: "AI設定ハブ",
    description: "AI関連の入口一覧（通常はAI判定ルールへ）",
    icon: Bot,
    group: "optional",
  },
  {
    href: "/admin/document-changes",
    label: "マニュアル変更の承認",
    description: "監視差分を台帳へ反映する",
    icon: ClipboardCheck,
    group: "ops",
  },
  {
    href: "/admin/rules/notifications",
    label: "通知一覧",
    description: "マニュアル変更などの通知履歴",
    icon: Bell,
    group: "ops",
  },
  {
    href: "/admin/rules/jobs",
    label: "ジョブ監視",
    description: "同期・監視の実行状況（トラブル時）",
    icon: Activity,
    group: "ops",
  },
]

export const RULES_MORE_GROUP_LABEL: Record<RulesMoreLink["group"], string> = {
  optional: "任意・精度向上",
  master: "マスタ・詳細",
  ops: "運用・監視",
}
