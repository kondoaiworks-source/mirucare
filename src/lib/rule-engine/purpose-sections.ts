import {
  BookOpen,
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
 * ホーム「よく使う設定」とルールブックハブ用。
 * ナビ主要項目は nav.ts 側（ルールブック構想）で定義する。
 * @see docs/ルールブック構想.md
 */
export type PurposeSection = {
  id: "rulebook" | "audit" | "ai"
  href: string
  label: string
  /** サイドナビ／カードの短い説明 */
  navDescription: string
  icon: LucideIcon
  /** 「この画面で行うこと」 */
  purpose: string
  steps: string[]
  /** ハブに出す管理対象カード */
  links: PurposeLink[]
  /** このセクション配下としてアクティブ判定するパス */
  matchPaths: string[]
  /** ホームの「よく使う」に出すか */
  showOnHome?: boolean
}

export const PURPOSE_SECTIONS: PurposeSection[] = [
  {
    id: "rulebook",
    href: "/admin/rules/regulatory",
    label: "ルールブック設定",
    navDescription: "この自治体で従う確定版を整える",
    icon: BookOpen,
    purpose:
      "国・県・市の参照URLと行政資料を整え、更新アラートを人が確認してルールブックを最新に保ちます。施設は「この自治体ならこのルールブック」に従えばよい、が目標です。",
    steps: [
      "サービスはいま訪問介護（Phase1）",
      "参照URL・行政資料を国／県／市で登録する",
      "更新アラートが出たら人が確認して反映する",
    ],
    links: [
      {
        href: "/admin/rules/source-urls",
        label: "参照URL登録",
        description: "法令・ルール・加算の公式URL（国・県・市）",
        icon: Link2,
      },
      {
        href: "/admin/rules/documents",
        label: "行政資料（監視）",
        description: "マニュアルPDFの台帳と自動更新アラート",
        icon: FileText,
      },
      {
        href: "/admin/rules/laws",
        label: "法令・根拠",
        description: "法令・通知のメタ情報",
        icon: Scale,
      },
      {
        href: "/admin/document-changes",
        label: "更新アラートの確認",
        description: "差分を人が見て台帳へ反映する",
        icon: ClipboardCheck,
      },
    ],
    matchPaths: [
      "/admin/rules/regulatory",
      "/admin/rules/documents",
      "/admin/rules/laws",
      "/admin/rules/source-urls",
      "/admin/document-changes",
    ],
    showOnHome: true,
  },
  {
    id: "audit",
    href: "/admin/rules/audit-items",
    label: "監査項目",
    navDescription: "ルールブック内の「何を見るか」",
    icon: ShieldCheck,
    purpose:
      "運営指導で確認されやすい項目（見出し）を登録します。判定ルールの土台です。日常は詳細設定から開きます。",
    steps: ["監査項目を選ぶ／登録する", "内容を確認する", "保存する"],
    links: [],
    matchPaths: ["/admin/rules/audit-items"],
    showOnHome: false,
  },
  {
    id: "ai",
    href: "/admin/rules/ai-rules",
    label: "判定ルール（詳細）",
    navDescription: "ルールブック内の「どう疑うか」",
    icon: Bot,
    purpose:
      "書類チェック用の見方を登録し、人が承認した版だけを本番に載せます。ルールブックの中身の部品です。",
    steps: [
      "ルールを登録する",
      "新ルール判定通知で確認する",
      "了承後にチェックで使われる",
    ],
    links: [
      {
        href: "/admin/rules/ai-rules",
        label: "判定ルールの登録・編集",
        description: "チェック用の具体的な見方",
        icon: ClipboardCheck,
      },
      {
        href: "/admin/rules/pending",
        label: "新ルール判定通知",
        description:
          "自治体ルールからAIが生成したチェックルールを確認して反映",
        icon: Landmark,
      },
    ],
    matchPaths: [
      "/admin/rules/ai-rules",
      "/admin/rules/ai",
      "/admin/rules/pending",
    ],
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
