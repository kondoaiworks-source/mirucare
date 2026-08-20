import {
  BookOpen,
  Bot,
  ClipboardCheck,
  Landmark,
  Layers,
  type LucideIcon,
} from "lucide-react"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

/** 目的別セクションの管理リンク */
export type PurposeLink = {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

/**
 * ホーム「よく使う設定」用（説明は短く）。
 * ナビ主要項目は nav.ts 側（ルールブック構想）で定義する。
 * @see docs/ルールブック構想.md
 */
export type PurposeSection = {
  id: "rulebook" | "ai"
  href: string
  label: string
  navDescription: string
  icon: LucideIcon
  purpose: string
  steps: string[]
  links: PurposeLink[]
  linksHeading?: string
  linksDescription?: string
  matchPaths: string[]
  showOnHome?: boolean
}

export const PURPOSE_SECTIONS: PurposeSection[] = [
  {
    id: "rulebook",
    href: "/admin/rules/setup",
    label: RULES_UI.setup,
    navDescription: "サービス設定",
    icon: Layers,
    purpose: "サービスと自治体を選び、ルールブックを確定します。",
    steps: [
      "サービスと自治体を選ぶ",
      "下書きを直して確定する",
      "ルールブックを閲覧する",
    ],
    links: [
      {
        href: "/admin/rules/services/homecare",
        label: "訪問介護",
        description: "サービス設定",
        icon: Landmark,
      },
      {
        href: "/admin/rules/monitoring",
        label: RULES_UI.monitoring,
        description: "同期結果とエラー",
        icon: ClipboardCheck,
      },
    ],
    linksHeading: "入口",
    linksDescription: "",
    matchPaths: [
      "/admin/rules/setup",
      "/admin/rules/domains",
      "/admin/rules/services",
      "/admin/rules/regulatory",
      "/admin/rules/services",
    ],
    showOnHome: true,
  },
  {
    id: "ai",
    href: "/admin/rules/ai-rules",
    label: RULES_UI.registeredRules,
    navDescription: "登録済みルールの確認",
    icon: Bot,
    purpose: "登録済みルールの確認用です。",
    steps: ["ルールブックを見て確定済みを確認する"],
    links: [
      {
        href: "/admin/rules/services/homecare",
        label: RULES_UI.judgmentRuleManage,
        description: "承認・一覧・生成",
        icon: BookOpen,
      },
    ],
    matchPaths: ["/admin/rules/ai-rules", "/admin/rules/ai"],
    showOnHome: false,
  },
]

export function getPurposeSection(
  id: PurposeSection["id"]
): PurposeSection | undefined {
  return PURPOSE_SECTIONS.find((s) => s.id === id)
}

export function findPurposeSectionByPath(
  pathname: string
): PurposeSection | undefined {
  const scored = PURPOSE_SECTIONS.map((section) => {
    const hit = section.matchPaths.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    )
    if (!hit) return { section, score: -1 }
    const best = Math.max(
      ...section.matchPaths
        .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
        .map((p) => p.length)
    )
    return { section, score: best }
  }).filter((x) => x.score >= 0)

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.section
}
