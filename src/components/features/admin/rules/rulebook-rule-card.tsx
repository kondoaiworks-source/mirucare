import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"

export const RULE_SCOPE_LABEL: Record<string, string> = {
  shared: "国・県",
  city: "市固有",
}

export function RuleScopeBadge({
  scopeKind,
}: {
  scopeKind?: string | null
}) {
  return (
    <Badge variant="outline" className="rounded-md">
      {RULE_SCOPE_LABEL[scopeKind ?? "shared"] ?? "国・県"}
    </Badge>
  )
}

type Props = {
  title: string
  badges?: ReactNode
  children?: ReactNode
  actions?: ReactNode
}

/**
 * ルールブック閲覧／下書きで共通の一覧カード。
 * 見出し・範囲バッジ・本文・操作の順。登録済み本文は読み取り専用にする。
 */
export function RulebookRuleCard({ title, badges, children, actions }: Props) {
  return (
    <li className="rounded-xl border border-border p-4">
      <div className="space-y-1">
        <p className="text-base font-semibold text-primary-dark">{title}</p>
        {badges ? (
          <div className="flex flex-wrap gap-1.5">{badges}</div>
        ) : null}
      </div>
      {children}
      {actions ? (
        <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </li>
  )
}
