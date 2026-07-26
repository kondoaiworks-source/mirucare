import {
  BookOpen,
  Bot,
  ClipboardCheck,
  Landmark,
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
    href: "/admin/rules/regulatory",
    label: "ルールブック設定",
    navDescription: "この自治体で従う確定版を整える",
    icon: BookOpen,
    purpose:
      "市のルールブック（自治体ルール設定）で国・県・市の参照URLを整え、PDFは自動監視します。更新アラートが出たら人が確認し、判定ルール案を了承してルールブックを最新に保ちます。施設は「この自治体ならこのルールブック」に従えばよい、が目標です。",
    steps: [
      "サービスはいま訪問介護（Phase1）",
      "市ルールブックの「自治体ルール設定」で国／県／市の参照URLを登録する（PDF直リンクがあると自動監視）",
      "更新アラートが出たら人が確認して判定ルール案を了承する",
    ],
    links: [
      {
        href: "/admin/document-changes",
        label: "更新アラートの確認",
        description: "差分を人が見て台帳へ反映する",
        icon: ClipboardCheck,
      },
    ],
    linksHeading: "更新アラート管理",
    linksDescription:
      "監視で見つかった差分を確認し、問題なければ台帳へ反映します。",
    matchPaths: [
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
      "運営指導で確認されやすい項目（見出し）を登録します。判定ルールの土台です。初回はルールブック設定のセットアップから登録できます。",
    steps: ["初回セットアップでテンプレート登録", "必要なら個別に追加", "保存する"],
    links: [],
    matchPaths: ["/admin/rules/audit-items"],
    showOnHome: false,
  },
  {
    id: "ai",
    href: "/admin/rules/ai-rules",
    label: "判定ルール一覧",
    navDescription: "登録済みルールの一覧（操作は市ルールブック）",
    icon: Bot,
    purpose:
      "一覧の確認用です。新規追加・了承は市のルールブックと新ルール判定通知から行います。",
    steps: [
      "市ルールブックで案を生成または手入力",
      "新ルール判定通知で了承する",
      "了承後にチェックで使われる",
    ],
    links: [
      {
        href: "/admin/rules/regulatory",
        label: "ルールブック設定",
        description: "市を開いて判定ルールを追加・了承する",
        icon: BookOpen,
      },
      {
        href: "/admin/rules/pending",
        label: "新ルール判定通知",
        description: "案の了承・差し戻し",
        icon: Landmark,
      },
    ],
    matchPaths: [
      "/admin/rules/ai-rules",
      "/admin/rules/ai",
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
