import {
  Activity,
  type LucideIcon,
} from "lucide-react"

/**
 * 「監視トラブル」に残すリンク。
 * 同期の結果は連携監視へ統合済み。
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
    label: "連携監視",
    description:
      "監視状況（OK／NG／差分あり）・登録済み台帳・手動登録。トラブル時や確認用です",
    icon: Activity,
    group: "trouble",
  },
]

export const RULES_MORE_GROUP_LABEL: Record<RulesMoreLink["group"], string> = {
  trouble: "トラブル対応（通常は触らない）",
}

export const RULES_MORE_GROUP_ORDER: RulesMoreLink["group"][] = ["trouble"]
