/**
 * 「監視トラブル」配下の補助リンク定義。
 * 同期結果は /admin/rules/more 本体に表示。例外の台帳操作は手動管理（documents）へ。
 * @see docs/ルールブック構想.md
 */
export type RulesMoreLink = {
  href: string
  label: string
  description: string
  group: "trouble"
}

/** ナビカード用（ページ本体では同期結果を直接表示するため、カード一覧は使わない） */
export const RULES_MORE_LINKS: RulesMoreLink[] = [
  {
    href: "/admin/rules/documents?register=1",
    label: "手動管理",
    description:
      "例外時のみ。台帳へマニュアルを直接登録・確認します（日常は自治体ルール設定）",
    group: "trouble",
  },
]

export const RULES_MORE_GROUP_LABEL: Record<RulesMoreLink["group"], string> = {
  trouble: "トラブル対応（通常は触らない）",
}

export const RULES_MORE_GROUP_ORDER: RulesMoreLink["group"][] = ["trouble"]
