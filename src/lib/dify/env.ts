/**
 * Dify 関連の環境変数を正規化する。
 * Vercel で末尾改行や引用符が付くことがあるため trim する。
 */

export function normalizeEnvValue(
  raw: string | undefined | null
): string {
  if (raw == null) return ""
  let v = String(raw).trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim()
  }
  return v
}

export function getDifyApiKey(): string {
  return normalizeEnvValue(process.env.DIFY_API_KEY)
}

export function getDifyBaseUrl(): string {
  const raw = normalizeEnvValue(process.env.DIFY_BASE_URL) || "https://api.dify.ai"
  return raw.replace(/\/$/, "").replace(/\/v1$/i, "")
}

export function getDifyMockFlag(): string {
  return normalizeEnvValue(process.env.DIFY_MOCK).toLowerCase()
}

/** Vercel 本番のみモック禁止（preview / ローカルは DIFY_MOCK に従う） */
export function isProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === "production"
}

export type MockDecision =
  | { mock: false }
  | {
      mock: true
      reason: "DIFY_MOCK" | "missing_api_key" | "mock_scenario"
    }

/**
 * モックを使うか判定する。
 * 本番では DIFY_MOCK=1 / キー未設定でも黙ってモックせず、呼び出し側でエラーにする。
 */
export function decideMockMode(options?: {
  mockScenario?: string
}): MockDecision {
  if (options?.mockScenario) {
    return { mock: true, reason: "mock_scenario" }
  }

  const flag = getDifyMockFlag()
  if (flag === "1" || flag === "true" || flag === "yes") {
    return { mock: true, reason: "DIFY_MOCK" }
  }

  if (!getDifyApiKey()) {
    return { mock: true, reason: "missing_api_key" }
  }

  return { mock: false }
}
