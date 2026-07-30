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
    href: "/admin/rules/services",
    label: "介護サービス選定",
    navDescription: "サービスから国・県・市区町村・監査カテゴリを整える",
    icon: Layers,
    purpose:
      "介護サービスを選び、国・県の公開情報→市区町村の運用／停止→監査カテゴリで判定ルールを了承します。施設は運用中のサービス×自治体だけを選べます。",
    steps: [
      "介護サービス選定で訪問介護を開く",
      "国・県ルール設定で公開情報PDFを登録する",
      "市区町村を運用し、監査カテゴリでルールを了承する",
    ],
    links: [
      {
        href: "/admin/rules/services/homecare/national-prefecture",
        label: "国・県ルール設定",
        description: "訪問介護共通の国・県PDF／URL",
        icon: Landmark,
      },
      {
        href: "/admin/document-changes",
        label: "更新アラートの確認",
        description: "差分を人が見て台帳へ反映する",
        icon: ClipboardCheck,
      },
    ],
    linksHeading: "よく使う導線",
    linksDescription:
      "サービス起点の設定と、監視で見つかった差分の確認です。",
    matchPaths: [
      "/admin/rules/services",
      "/admin/rules/regulatory",
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
      "運営指導で確認されやすい項目（見出し）を登録します。判定ルールの土台です。日常は監査カテゴリ設定から進めます。",
    steps: [
      "初回セットアップでテンプレート登録",
      "必要なら個別に追加",
      "保存する",
    ],
    links: [],
    matchPaths: ["/admin/rules/audit-items"],
    showOnHome: false,
  },
  {
    id: "ai",
    href: "/admin/rules/ai-rules",
    label: "判定ルール一覧",
    navDescription: "登録済みルールの一覧（操作は監査カテゴリ／ルール管理）",
    icon: Bot,
    purpose:
      "一覧の確認用です。新規追加・了承は監査カテゴリとルール管理から行います。",
    steps: [
      "監査カテゴリまたは市設定で案を生成",
      "ルール管理で了承する",
      "了承後にチェックで使われる",
    ],
    links: [
      {
        href: "/admin/rules/services/homecare",
        label: "訪問介護の設定",
        description: "国・県・市区町村・監査カテゴリへ",
        icon: BookOpen,
      },
      {
        href: "/admin/rules/pending",
        label: "ルール管理",
        description: "案の了承・差し戻し（横断キュー）",
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
