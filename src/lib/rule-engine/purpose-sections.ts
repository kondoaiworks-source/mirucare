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
  /** ホームで示す、登録する元データ */
  dataToRegister: string
  /** ホームで示す、登録データの使い道 */
  usedFor: string
  /** 業種を問わず伝えるための例え */
  plainExample: string
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
      "公的な指導・監査で見られやすい確認項目を、AIが使うチェックリストとして登録します。介護でいえば契約書の署名、計画の同意日、サービス提供記録の日付などです。",
    dataToRegister:
      "公的な指導・監査で確認される項目名、説明、対象書類、リスクの目安",
    usedFor:
      "利用者が書類をアップロードしたとき、AIが「どの観点を確認するか」を決める土台にします。",
    plainExample:
      "飲食店なら衛生チェック表、建設業なら安全点検表のような「見るべき項目リスト」です。",
    steps: ["登録先を選ぶ", "見るべき項目を登録", "AIルールへつなげる"],
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
      "追加で請求・算定する項目について、必要な条件と書類を登録します。介護でいえば特定事業所加算など、要件を満たしているか確認したい項目です。",
    dataToRegister:
      "加算の名称、算定条件、必要書類、確認したい記録や期限",
    usedFor:
      "AIが書類を見るとき、加算に必要な条件や添付書類がそろっている可能性があるかを確認する材料にします。",
    plainExample:
      "補助金申請や追加料金メニューで「この条件を満たしたときだけ申請・請求できる」と整理する表です。",
    steps: ["加算を選ぶ", "条件と必要書類を確認", "保存"],
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
      "AIに「どの書類の、どの記載を、どう確認するか」を教えます。断定ではなく「不備の可能性があります」「ご確認ください」と案内するための判定基準です。",
    dataToRegister:
      "対象書類、確認する記載、疑う条件、利用者へ出す案内文、根拠への紐づけ",
    usedFor:
      "AIがアップロード書類を読んだあと、指摘候補と確認理由を作るときの判断材料にします。",
    plainExample:
      "新人担当者向けの作業手順書に「この欄が空なら確認する」と書いておくイメージです。",
    steps: [
      "確認したい項目を選ぶ",
      "AIへの指示を登録",
      "承認して使える状態にする",
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
      "AIの根拠確認に使う公式資料や参照サイトを登録します。法改正や自治体資料の更新時に、古い情報のまま案内しないために見直します。",
    dataToRegister:
      "厚労省・自治体などの公式PDF、通知、マニュアル、参照URL",
    usedFor:
      "AIや運営担当者が、指摘候補の根拠を確認するときの参照先として使います。",
    plainExample:
      "会社の規程集や官公庁サイトのリンク集を、チェック担当者がすぐ見られる場所に置くイメージです。",
    steps: ["公式資料を選ぶ", "PDFやURLを更新", "変更があれば承認"],
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
