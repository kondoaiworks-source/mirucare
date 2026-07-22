import {
  Bot,
  ClipboardCheck,
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

/**
 * ホーム「目的から選ぶ」とサイドナビの主要3本。
 * 加算・ジョブ等は more-links 側（その他の設定）。
 */
export type PurposeSection = {
  id: "audit" | "ai" | "regulatory"
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
    label: "監査項目",
    navDescription: "何を確認するか",
    icon: ShieldCheck,
    purpose:
      "運営指導で確認されやすい項目を登録します。AI判定ルールの土台になります。",
    steps: ["監査項目を選ぶ／登録する", "内容を確認する", "保存する"],
    links: [],
    matchPaths: ["/admin/rules/audit-items"],
  },
  {
    id: "ai",
    href: "/admin/rules/ai-rules",
    label: "AI判定ルール",
    navDescription: "どう確認するか",
    icon: Bot,
    purpose:
      "書類チェックの判定基準を登録し、承認後にチェックへ反映します。",
    steps: [
      "ルールを登録する",
      "承認待ちで確認する",
      "承認後にチェックで使われる",
    ],
    links: [
      {
        href: "/admin/rules/ai-rules",
        label: "AI判定ルール",
        description: "判定基準の登録・編集",
        icon: ClipboardCheck,
      },
    ],
    matchPaths: [
      "/admin/rules/ai-rules",
      "/admin/rules/ai",
      "/admin/rules/pending",
    ],
  },
  {
    id: "regulatory",
    href: "/admin/rules/regulatory",
    label: "行政情報",
    navDescription: "根拠・法改正の更新",
    icon: Landmark,
    purpose:
      "行政マニュアルや参照サイトを整え、法改正時に最新へ更新します。",
    steps: ["行政資料を確認する", "参照サイトを更新する", "必要なら差分を承認する"],
    links: [
      {
        href: "/admin/rules/documents",
        label: "行政資料",
        description: "マニュアルPDFや監視設定",
        icon: FileText,
      },
      {
        href: "/admin/rules/source-urls",
        label: "参照サイト",
        description: "公式URLの一覧",
        icon: Link2,
      },
      {
        href: "/admin/rules/laws",
        label: "法令・根拠",
        description: "法令・通知のメタ情報",
        icon: Scale,
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
  // より具体的な match を優先
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
