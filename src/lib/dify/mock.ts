import type { DifyCheckInput, DifyCheckResult, MockScenario } from "./types"
import { parseWithRetryAndFallback } from "./parse"
import { decideMockMode, isProductionRuntime } from "./env"

const SUCCESS_JSON = JSON.stringify({
  findings: [
    {
      severity: "high",
      title: "同意欄の日付が空欄の可能性があります",
      description:
        "利用者・家族の同意（署名や同意の記録）欄に日付が入っていないように見えます。実地指導（運営指導）で確認されやすい箇所ですので、ご確認ください。",
      basis: "運営基準に関する通知／貴自治体の指導資料",
      suggestion:
        "同意を得た日付を記入し、署名または記名押印があるかご確認ください。電子同意の場合は同意日時の記録をご確認ください。",
    },
    {
      severity: "mid",
      title: "サービス提供日と計画の整合をご確認ください",
      description:
        "提供記録の日付と、ケアプラン上の予定日にずれがある可能性があります。記録の転記ミスがないかご確認ください。",
      basis: "サービス提供記録の記載に関する留意事項",
      suggestion:
        "提供日・サービス内容・担当者を計画と突き合わせ、相違があれば理由をメモに残すことをおすすめします。",
    },
    {
      severity: "low",
      title: "書類名の表記ゆれがある可能性があります",
      description:
        "ファイル名と帳票タイトルの表記が一致していない可能性があります。参照時の混乱を防ぐため、統一をご検討ください。",
      basis: "事業所内の帳票管理の推奨事項",
      suggestion:
        "帳票タイトルと保存ファイル名を揃えると、後からの確認がしやすくなります。",
    },
  ],
})

const EMPTY_JSON = JSON.stringify({ findings: [] })

const BROKEN_TEXT = `チェック結果です。
これは壊れた応答で、JSONになっていません。
違反っぽい箇所があるかもしれませんが構造化できません。`

export function resolveMockScenario(
  override?: MockScenario
): MockScenario {
  if (override) return override
  const env = process.env.DIFY_MOCK_SCENARIO?.trim().toLowerCase()
  if (env === "parse_error" || env === "empty" || env === "zero" || env === "success") {
    return env === "zero" ? "empty" : env
  }
  return "success"
}

/**
 * ローカル開発向け。本番では常に false（黙ってモックしない）。
 * @deprecated decideMockMode を優先。互換のため残す。
 */
export function isMockMode(): boolean {
  if (isProductionRuntime()) return false
  return decideMockMode().mock
}

/**
 * Dify を呼ばず、シナリオ別の応答を返す
 */
export async function runMockDifyCheck(
  input: DifyCheckInput
): Promise<DifyCheckResult> {
  const scenario = resolveMockScenario(input.mockScenario)

  console.error("[dify] mock_response", {
    scenario,
    docType: input.docType,
    hasText: Boolean(input.documentText?.trim()),
    hasImage: Boolean(input.imageBase64),
  })

  // 入力が渡されていることをログ相当で検証（個人情報は出さない）
  void input.municipality
  void input.prefecture
  void input.national
  void input.approvedRulesJson
  void input.regulatoryBasisJson
  void input.checkAsOf

  console.error("[dify] mock_rules_payload", {
    hasRulesJson: Boolean(input.approvedRulesJson && input.approvedRulesJson !== "[]"),
    hasBasisJson: Boolean(
      input.regulatoryBasisJson && input.regulatoryBasisJson !== "[]"
    ),
    checkAsOf: input.checkAsOf ?? null,
  })

  if (scenario === "parse_error") {
    return parseWithRetryAndFallback(BROKEN_TEXT, [
      BROKEN_TEXT.replace("壊れた", "still broken"),
    ])
  }

  if (scenario === "empty" || scenario === "zero") {
    return parseWithRetryAndFallback(EMPTY_JSON)
  }

  return parseWithRetryAndFallback(SUCCESS_JSON)
}

export function mockRawForScenario(scenario: MockScenario): string {
  if (scenario === "parse_error") return BROKEN_TEXT
  if (scenario === "empty" || scenario === "zero") return EMPTY_JSON
  return SUCCESS_JSON
}
