import {
  BookOpen,
  Bot,
  ClipboardCheck,
  Landmark,
  Layers,
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
  /** リンク一覧の見出し（省略時は「管理一覧」） */
  linksHeading?: string
  /** リンク一覧の説明（省略時は汎用文） */
  linksDescription?: string
  /** このセクション配下としてアクティブ判定するパス */
  matchPaths: string[]
  /** ホームの「よく使う」に出すか */
  showOnHome?: boolean
}

export const PURPOSE_SECTIONS: PurposeSection[] = [
  {
    id: "rulebook",
    href: "/admin/rules/setup",
    label: "利用設定",
    navDescription: "サービス→根拠URL→判定ルール",
    icon: Layers,
    purpose:
      "サービス・対象自治体・根拠URLを登録し、判定ルールを了承します。",
    steps: [
      "サービスと対象自治体を選ぶ",
      "国・県・市の根拠URLを登録する",
      "判定ルールを生成し了承する",
    ],
    links: [
      {
        href: "/admin/rules/services/homecare/national-prefecture",
        label: "国・県の根拠URL",
        description: "訪問介護共通の国・県PDF",
        icon: Landmark,
      },
      {
        href: "/admin/rules/monitoring",
        label: "監視状況",
        description: "同期結果とエラーの確認",
        icon: ClipboardCheck,
      },
    ],
    linksHeading: "よく使う導線",
    linksDescription: "設定と監視の入口です。",
    matchPaths: [
      "/admin/rules/setup",
      "/admin/rules/services",
      "/admin/rules/regulatory",
      "/admin/rules/pending",
    ],
    showOnHome: true,
  },
  {
    id: "audit",
    href: "/admin/rules/audit-items",
    label: "カテゴリ",
    navDescription: "ルールブックに載せるカテゴリ",
    icon: ShieldCheck,
    purpose:
      "ルールブックに載せるカテゴリ（何を見るか）を登録します。初回は標準セットで足ります。",
    steps: [
      "対象（市×サービス＝ルールブック）を選ぶ",
      "標準カテゴリセットを登録する",
      "必要なら個別追加する",
    ],
    links: [],
    matchPaths: ["/admin/rules/audit-items"],
    showOnHome: false,
  },
  {
    id: "ai",
    href: "/admin/rules/ai-rules",
    label: "判定ルール一覧",
    navDescription: "登録済みルールの確認用一覧",
    icon: Bot,
    purpose: "一覧確認用です。追加・了承は利用設定から行います。",
    steps: [
      "利用設定で案を生成",
      "判定ルールで了承する",
      "了承後にチェックで使う",
    ],
    links: [
      {
        href: "/admin/rules/setup",
        label: "利用設定",
        description: "サービス・根拠URL・ルールへ",
        icon: BookOpen,
      },
      {
        href: "/admin/rules/pending",
        label: "判定ルール",
        description: "了承・一覧・案の生成",
        icon: Landmark,
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
