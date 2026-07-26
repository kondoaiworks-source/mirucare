import {
  Activity,
  FileText,
  type LucideIcon,
} from "lucide-react"

/**
 * 「監視トラブル」（旧・詳細設定）に残すリンク。
 * 判定ルール・監査項目は市ルールブック／新ルール判定通知側。
 * @see docs/ルールブック構想.md
 */
export type RulesMoreLink = {
  href: string
  label: string
  description: string
  icon: LucideIcon
  group: "trouble"
}

export const RULES_MORE_LINKS: RulesMoreLink[] = [
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
  trouble: "トラブル対応（通常は触らない）",
}

export const RULES_MORE_GROUP_ORDER: RulesMoreLink["group"][] = ["trouble"]
