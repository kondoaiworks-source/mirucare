/**
 * 使い方ページの文言
 */

export type GuideHowStep = {
  title: string
  paragraphs: readonly string[]
  bullets?: readonly string[]
  closing?: string
}

export const GUIDE_UI = {
  title: "使い方",

  aboutTitle: "このアプリについて",
  aboutBody:
    "本アプリは、介護サービス事業所の法令・運営ルールの遵守を支援するアプリです。",

  howTitle: "使い方",
  howSteps: [
    {
      title: "① ルールブックを作成する",
      paragraphs: [
        "サービス種別と、サービスを提供している自治体を選択します。",
        "国・都道府県・市区町村が公開しているルールのURLを登録します。",
        "AIが公開情報を解析し、事業所で利用するルール案を自動作成します。",
        "内容を確認し、「採用」「不採用」または「修正」を行うことで、自社専用のルールブックが完成します。",
      ],
    },
    {
      title: "② 書類をチェックする",
      paragraphs: [
        "ルールブック作成後は、各種書類をアップロードするだけで、",
      ],
      bullets: [
        "ルールブックに基づくチェック",
        "書類同士の整合性チェック",
      ],
      closing: "をいつでも実施できます。",
    },
    {
      title: "③ ルール改正にも自動対応",
      paragraphs: [
        "登録したURLは1日1回自動で差分チェックを行います。",
        "法令や自治体ルールに変更があった場合は、",
      ],
      bullets: [
        "変更箇所",
        "現在のルールブックのどのルールを修正すべきか",
        "AIによる修正案",
      ],
      closing: "を表示します。",
    },
  ] satisfies readonly GuideHowStep[],
} as const
