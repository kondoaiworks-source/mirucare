import {
  Activity,
  Bot,
  Coins,
  FileText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

/**
 * 「詳細設定」に残すリンク。
 * 日常はルールブック設定／新ルール判定通知。ここは中身の手直しと監視トラブル時のみ。
 * @see docs/ルールブック構想.md
 */
export type RulesMoreLink = {
  href: string
  label: string
  description: string
  icon: LucideIcon
  group: "content" | "trouble"
}

export const RULES_MORE_LINKS: RulesMoreLink[] = [
  {
    href: "/admin/rules/audit-items",
    label: "監査項目",
    description: "チェックで「何を見るか」の見出し。判定ルールの土台です",
    icon: ShieldCheck,
    group: "content",
  },
  {
    href: "/admin/rules/ai-rules",
    label: "判定ルール",
    description: "「どう疑うか」の本文。了承後にチェックへ使われます",
    icon: Bot,
    group: "content",
  },
  {
    href: "/admin/rules/additions",
    label: "加算設定",
    description: "加算の算定条件・必要書類（任意・精度向上）",
    icon: Coins,
    group: "content",
  },
  {
    href: "/admin/rules/documents",
    label: "行政資料台帳",
    description: "自動登録の失敗や手動同期など、トラブル時だけ開きます",
    icon: FileText,
    group: "trouble",
  },
  {
    href: "/admin/rules/jobs",
    label: "同期の結果",
    description: "行政資料の自動取得が成功／失敗したかの確認",
    icon: Activity,
    group: "trouble",
  },
]

export const RULES_MORE_GROUP_LABEL: Record<RulesMoreLink["group"], string> = {
  content: "チェックの中身（手で直すとき）",
  trouble: "トラブル対応（通常は触らない）",
}

export const RULES_MORE_GROUP_ORDER: RulesMoreLink["group"][] = [
  "content",
  "trouble",
]
