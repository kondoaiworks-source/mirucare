import {
  Bot,
  ClipboardCheck,
  Coins,
  FileText,
  Landmark,
  Link2,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

/** 目的別セクションの管理リンク */
export type PurposeLink = {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

/** 目的別TOPの定義（ナビ・ガイド・ハブで共有） */
export type PurposeSection = {
  id: "audit" | "additions" | "ai" | "regulatory"
  href: string
  label: string
  /** サイドナビの短い説明 */
  navDescription: string
  icon: LucideIcon
  /** 「この画面で行うこと」 */
  purpose: string
  steps: string[]
  /** ハブに出す管理対象カード（単一対象の画面では空でも可） */
  links: PurposeLink[]
  /** このセクション配下としてアクティブ判定するパス */
  matchPaths: string[]
}

export const PURPOSE_SECTIONS: PurposeSection[] = [
  {
    id: "audit",
    href: "/admin/rules/audit-items",
    label: "監査対策",
    navDescription: "指摘されやすい項目を整える",
    icon: ShieldCheck,
    purpose:
      "運営指導・監査で確認される内容を管理します。監査項目や必要書類を確認・編集できます。",
    steps: ["監査項目を選択", "内容を確認・編集", "保存"],
    links: [],
    matchPaths: ["/admin/rules/audit-items"],
  },
  {
    id: "additions",
    href: "/admin/rules/additions",
    label: "加算設定",
    navDescription: "算定条件と必要書類を整える",
    icon: Coins,
    purpose:
      "介護報酬の加算要件を管理します。必要書類や算定条件を確認・編集できます。",
    steps: ["加算を選択", "算定条件を確認", "必要書類を確認", "保存"],
    links: [],
    matchPaths: ["/admin/rules/additions"],
  },
  {
    id: "ai",
    href: "/admin/rules/ai",
    label: "AI設定",
    navDescription: "判定の基準を整える",
    icon: Bot,
    purpose:
      "AIが判定する基準を設定します。法令・行政資料・独自ルールをAIへ反映します。",
    steps: [
      "AI判定ルールを選択",
      "行政資料・法令を確認",
      "ルールを編集",
      "AIテストを実行",
      "保存",
    ],
    links: [
      {
        href: "/admin/rules/ai-rules",
        label: "AI判定ルール",
        description: "書類チェックの判定基準を確認・編集します。",
        icon: ClipboardCheck,
      },
      {
        href: "/admin/rules/documents",
        label: "行政資料",
        description: "AIが参照する行政マニュアルを確認します。",
        icon: FileText,
      },
      {
        href: "/admin/rules/laws",
        label: "法令・根拠",
        description: "法令・通知など判定の根拠を確認します。",
        icon: Scale,
      },
    ],
    matchPaths: ["/admin/rules/ai", "/admin/rules/ai-rules"],
  },
  {
    id: "regulatory",
    href: "/admin/rules/regulatory",
    label: "法改正・行政情報",
    navDescription: "最新の行政情報へ更新する",
    icon: Landmark,
    purpose:
      "AIが参照する行政資料・法令・参考サイトを管理します。法改正時に最新情報へ更新します。",
    steps: ["行政資料を選択", "URLまたは資料を更新", "保存"],
    links: [
      {
        href: "/admin/rules/documents",
        label: "行政資料",
        description: "行政マニュアルのPDFや監視設定を更新します。",
        icon: FileText,
      },
      {
        href: "/admin/rules/laws",
        label: "法令・根拠",
        description: "法令・通知のメタ情報を確認・更新します。",
        icon: Scale,
      },
      {
        href: "/admin/rules/source-urls",
        label: "参照サイト",
        description: "自治体・厚労省などの原文URLを管理します。",
        icon: Link2,
      },
    ],
    matchPaths: [
      "/admin/rules/regulatory",
      "/admin/rules/documents",
      "/admin/rules/laws",
      "/admin/rules/source-urls",
    ],
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
  // より具体的な match を優先（ai-rules は ai、documents は regulatory など）
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
