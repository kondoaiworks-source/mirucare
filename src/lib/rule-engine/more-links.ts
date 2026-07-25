import {
  Bot,
  ClipboardCheck,
  Coins,
  FileText,
  Link2,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

/** 「詳細設定」にまとめるリンク（ルールブック構想の裏側部品） */
export type RulesMoreLink = {
  href: string
  label: string
  description: string
  icon: LucideIcon
  group: "core" | "optional" | "ledger"
}

export const RULES_MORE_LINKS: RulesMoreLink[] = [
  {
    href: "/admin/rules/audit-items",
    label: "監査項目",
    description: "ルールブック内の「何を見るか」（見出し）",
    icon: ShieldCheck,
    group: "core",
  },
  {
    href: "/admin/rules/ai-rules",
    label: "判定ルール",
    description: "ルールブック内の「どう疑うか」。承認後にチェックへ",
    icon: Bot,
    group: "core",
  },
  {
    href: "/admin/rules/additions",
    label: "加算設定",
    description: "加算の算定条件・必要書類（任意）",
    icon: Coins,
    group: "optional",
  },
  {
    href: "/admin/rules/source-urls",
    label: "参照URL（詳細）",
    description: "通常はルールブック設定から開きます",
    icon: Link2,
    group: "ledger",
  },
  {
    href: "/admin/rules/documents",
    label: "行政資料（台帳）",
    description: "マニュアルPDF・監視設定の詳細",
    icon: FileText,
    group: "ledger",
  },
  {
    href: "/admin/rules/laws",
    label: "法令・根拠",
    description: "法令・通知のメタ情報",
    icon: Scale,
    group: "ledger",
  },
  {
    href: "/admin/document-changes",
    label: "マニュアル変更の承認",
    description: "更新アラートの差分を台帳へ反映",
    icon: ClipboardCheck,
    group: "ledger",
  },
]

export const RULES_MORE_GROUP_LABEL: Record<RulesMoreLink["group"], string> = {
  core: "ルールブックの中身（詳細）",
  optional: "任意・精度向上",
  ledger: "台帳・差分（詳細）",
}
