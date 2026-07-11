import { isMockMode, runMockDifyCheck } from "./mock"
import { parseWithRetryAndFallback } from "./parse"
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

function pickAnswerText(payload: DifyWorkflowResponse): string {
  if (typeof payload.answer === "string" && payload.answer.trim()) {
    return payload.answer
  }

  const outputs = payload.data?.outputs
  if (outputs) {
    for (const key of ["result", "text", "answer", "output", "findings"]) {
      const v = outputs[key]
      if (typeof v === "string" && v.trim()) return v
      if (v && typeof v === "object") return JSON.stringify(v)
    }
    // outputs 全体を JSON として試す
    return JSON.stringify(outputs)
  }

  if (typeof payload.message === "string") return payload.message
  return JSON.stringify(payload)
}

/**
 * Dify Workflow / Chat へチェック依頼を送る。
 * APIキーはサーバー環境変数のみ。クライアントに露出しない。
 */
export async function runDifyCheck(
  input: DifyCheckInput
): Promise<DifyCheckResult> {
  if (isMockMode() || input.mockScenario) {
    return runMockDifyCheck(input)
  }

  const apiKey = process.env.DIFY_API_KEY!.trim()
  const baseUrl = (process.env.DIFY_BASE_URL ?? "https://api.dify.ai").replace(
    /\/$/,
    ""
  )

  const inputs: Record<string, string> = {
    municipality: input.municipality || "未設定",
    service_type: input.serviceType,
    doc_type: input.docType,
    document_text: input.documentText?.slice(0, 80000) ?? "",
  }

  // 画像はビジョン入力用に渡す（Workflow 側で files / image 変数を受ける想定）
  if (input.imageBase64) {
    inputs.image_base64 = input.imageBase64
    inputs.image_mime_type = input.imageMimeType ?? "image/jpeg"
  }

  const body = {
    inputs,
    response_mode: "blocking",
    user: "kansatsu-check",
  }

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
        repairTexts.push(text)
        continue
      }

      let payload: DifyWorkflowResponse
      try {
        payload = JSON.parse(text) as DifyWorkflowResponse
      } catch {
        repairTexts.push(text)
        continue
      }

      const answer = pickAnswerText(payload)
      const parsed = parseWithRetryAndFallback(answer, repairTexts)
      if (parsed.parseOk || attempt === maxAttempts) {
        return parsed
      }
      repairTexts.push(answer)
    } catch (err) {
      lastRaw = err instanceof Error ? err.message : "network_error"
      repairTexts.push(lastRaw)
    }
  }

  return parseWithRetryAndFallback(lastRaw || "{}", repairTexts)
}
