import { runMockDifyCheck } from "./mock"
import { parseWithRetryAndFallback } from "./parse"
import {
  decideMockMode,
  getDifyApiKey,
  getDifyBaseUrl,
  isProductionRuntime,
} from "./env"
import {
  DIFY_CHECK_USER,
  getDifyFileInputKey,
  uploadBase64AsDifyFile,
  type DifyFileMapping,
} from "./files"
import type { DifyCheckInput, DifyCheckResult } from "./types"

type DifyWorkflowResponse = {
  data?: {
    outputs?: Record<string, unknown>
    status?: string
    error?: string
  }
  answer?: string
  message?: string
}

/**
 * Workflow outputs から findings 候補テキストを取り出す。
 * 個人名・被保険者番号はログに出さない。
 */
function pickAnswerText(payload: DifyWorkflowResponse): string {
  if (typeof payload.answer === "string" && payload.answer.trim()) {
    return payload.answer
  }

  const outputs = payload.data?.outputs
  if (outputs) {
    for (const key of [
      "check_result",
      "result",
      "text",
      "answer",
      "output",
      "findings",
      "json",
      "data",
    ]) {
      const extracted = coerceOutputValue(outputs[key])
      if (extracted) return extracted
    }
    // outputs 全体を JSON として試す
    return JSON.stringify(outputs)
  }

  if (typeof payload.message === "string") return payload.message
  return JSON.stringify(payload)
}

function coerceOutputValue(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim()
  if (Array.isArray(v)) return JSON.stringify(v)
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>
    if (
      Array.isArray(obj.findings) ||
      Array.isArray(obj.items) ||
      Array.isArray(obj.results)
    ) {
      return JSON.stringify(obj)
    }
    // 1段ネスト（例: { text: "..." } / { result: {...} }）
    for (const key of [
      "check_result",
      "result",
      "text",
      "answer",
      "output",
      "findings",
      "json",
    ]) {
      const inner = obj[key]
      if (typeof inner === "string" && inner.trim()) return inner.trim()
      if (inner && typeof inner === "object") return JSON.stringify(inner)
    }
    return JSON.stringify(obj)
  }
  return null
}

function logDifyDiag(info: {
  attempt: number
  httpStatus?: number
  workflowStatus?: string
  outputKeys?: string[]
  answerLength?: number
  parseOk?: boolean
  usedFallback?: boolean
  errorKind?: string
}) {
  console.error("[dify] check", {
    attempt: info.attempt,
    httpStatus: info.httpStatus,
    workflowStatus: info.workflowStatus,
    outputKeys: info.outputKeys,
    answerLength: info.answerLength,
    parseOk: info.parseOk,
    usedFallback: info.usedFallback,
    errorKind: info.errorKind,
  })
}

/**
 * Dify Workflow へチェック依頼を送る。
 * APIキーはサーバー環境変数のみ。クライアントに露出しない。
 *
 * Workflow 入力変数:
 * - document_text / prefecture / municipality / doc_type / national
 * - files（File Array）: 画像・スキャンPDF は File Upload 後に載せる
 */
export async function runDifyCheck(
  input: DifyCheckInput
): Promise<DifyCheckResult> {
  const decision = decideMockMode({ mockScenario: input.mockScenario })

  if (decision.mock) {
    // 本番では黙ってモックせず失敗させる（監視0のまま成功するのを防ぐ）
    if (isProductionRuntime() && decision.reason !== "mock_scenario") {
      console.error("[dify] refuse_mock_in_production", {
        reason: decision.reason,
      })
      throw new Error(
        decision.reason === "missing_api_key"
          ? "DIFY_API_KEY が未設定です。Vercel の環境変数を確認してください。"
          : "本番で DIFY_MOCK が有効です。DIFY_MOCK=0 にして再デプロイしてください。"
      )
    }

    // 開発時の mockScenario 指定、または明示的モック
    if (isProductionRuntime() && decision.reason === "mock_scenario") {
      console.error("[dify] refuse_client_mock_scenario_in_production")
      throw new Error("本番ではモックシナリオを指定できません。")
    }

    console.error("[dify] using_mock", { reason: decision.reason })
    return runMockDifyCheck(input)
  }

  const apiKey = getDifyApiKey()
  const baseUrl = getDifyBaseUrl()
  const fileInputKey = getDifyFileInputKey()

  const inputs: Record<string, string | DifyFileMapping[]> = {
    document_text: input.documentText?.slice(0, 80000) ?? "",
    prefecture: input.prefecture || "",
    municipality: input.municipality || "",
    doc_type: input.docType,
    national: input.national,
  }

  let hasVisionFile = false
  let visionMappings: DifyFileMapping[] = []
  if (input.imageBase64) {
    try {
      const mapping = await uploadBase64AsDifyFile({
        imageBase64: input.imageBase64,
        mimeType: input.imageMimeType ?? "image/png",
        fileName: `check.${(input.imageMimeType ?? "image/png").includes("png") ? "png" : "jpg"}`,
      })
      visionMappings = [mapping]
      inputs[fileInputKey] = visionMappings
      hasVisionFile = true
    } catch (err) {
      console.error("[dify] vision_file_skip", {
        errorKind: err instanceof Error ? err.name : "unknown",
        message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      })
      // アップロード失敗時は従来どおり base64 文字列も送る（テキスト経路の保険）
      inputs.image_base64 = input.imageBase64
      inputs.image_mime_type = input.imageMimeType ?? "image/jpeg"
    }
  }

  const body: {
    inputs: Record<string, string | DifyFileMapping[]>
    response_mode: "blocking"
    user: string
    files?: Array<DifyFileMapping & { variable: string }>
  } = {
    inputs,
    response_mode: "blocking",
    user: DIFY_CHECK_USER,
  }

  // 一部の Dify 版は top-level files + variable 名が必要
  if (visionMappings.length > 0) {
    body.files = visionMappings.map((m) => ({
      ...m,
      variable: fileInputKey,
    }))
  }

  console.error("[dify] invoke_live", {
    baseUrl,
    hasKey: Boolean(apiKey),
    keyPrefix: apiKey.slice(0, 4),
    textLength:
      typeof inputs.document_text === "string" ? inputs.document_text.length : 0,
    hasImage: Boolean(input.imageBase64),
    hasVisionFile,
    fileInputKey,
    docType: input.docType,
    national: input.national,
  })

  const maxAttempts = 3
  let lastRaw = ""
  const repairTexts: string[] = []

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/v1/workflows/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const text = await res.text()
      lastRaw = text

      if (!res.ok) {
        logDifyDiag({
          attempt,
          httpStatus: res.status,
          errorKind: "http_error",
          answerLength: text.length,
        })
        repairTexts.push(text)
        continue
      }

      let payload: DifyWorkflowResponse
      try {
        payload = JSON.parse(text) as DifyWorkflowResponse
      } catch {
        logDifyDiag({
          attempt,
          httpStatus: res.status,
          errorKind: "invalid_json_body",
          answerLength: text.length,
        })
        repairTexts.push(text)
        continue
      }

      const outputKeys = payload.data?.outputs
        ? Object.keys(payload.data.outputs)
        : []
      const answer = pickAnswerText(payload)
      const parsed = parseWithRetryAndFallback(answer, repairTexts)

      if (!parsed.parseOk) {
        logDifyDiag({
          attempt,
          httpStatus: res.status,
          workflowStatus: payload.data?.status,
          outputKeys,
          answerLength: answer.length,
          parseOk: false,
          usedFallback: parsed.usedFallback,
          errorKind: "parse_failed",
        })
      }

      if (parsed.parseOk || attempt === maxAttempts) {
        if (parsed.usedFallback) {
          logDifyDiag({
            attempt,
            httpStatus: res.status,
            workflowStatus: payload.data?.status,
            outputKeys,
            answerLength: answer.length,
            parseOk: false,
            usedFallback: true,
            errorKind: "fallback",
          })
        } else {
          logDifyDiag({
            attempt,
            httpStatus: res.status,
            workflowStatus: payload.data?.status,
            outputKeys,
            answerLength: answer.length,
            parseOk: true,
            usedFallback: false,
          })
        }
        return parsed
      }
      repairTexts.push(answer)
    } catch (err) {
      lastRaw = err instanceof Error ? err.message : "network_error"
      logDifyDiag({
        attempt,
        errorKind: "network_or_throw",
        answerLength: lastRaw.length,
      })
      repairTexts.push(lastRaw)
    }
  }

  const fallback = parseWithRetryAndFallback(lastRaw || "{}", repairTexts)
  logDifyDiag({
    attempt: maxAttempts,
    parseOk: fallback.parseOk,
    usedFallback: fallback.usedFallback,
    errorKind: "exhausted_retries",
  })
  return fallback
}
