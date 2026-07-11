import { runMockDifyCheck } from "./mock"
import { buildFallbackFinding, parseWithRetryAndFallback } from "./parse"
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
import { CHECK_UI } from "@/lib/copy/check-ui"

type DifyWorkflowResponse = {
  data?: {
    outputs?: Record<string, unknown>
    status?: string
    error?: string
  }
  answer?: string
  message?: string
  code?: string
  status?: number
}

type WorkflowRequestBody = {
  inputs: Record<string, string>
  response_mode: "blocking"
  user: string
  files?: Array<DifyFileMapping & { variable: string }>
}

type WorkflowAttemptResult =
  | { kind: "ok"; result: DifyCheckResult }
  | { kind: "empty_messages"; raw: string; hint: string }
  | { kind: "continue"; raw: string; hint?: string }

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
  errorHint?: string
  withoutFiles?: boolean
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
    errorHint: info.errorHint,
    withoutFiles: info.withoutFiles,
  })
}

/** document_text が空だと LLM の messages が空になり 400 になることがある */
function ensureDocumentText(raw: string | undefined, hasImage: boolean): string {
  const text = (raw ?? "").trim()
  if (text.length > 0) return text.slice(0, 80000)
  if (hasImage) {
    return "（添付の画像ファイルを読み取り、介護書類として点検してください。結果は指定の JSON 形式で返してください。）"
  }
  return "（書類テキストが取得できませんでした。可能な範囲でご確認ください。）"
}

function sanitizeErrorHint(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  const s = raw.replace(/\s+/g, " ").trim().slice(0, 180)
  if (/at least one message is required/i.test(s)) {
    return "llm_empty_messages"
  }
  if (/invalid_param|must be a file/i.test(s)) {
    return "invalid_file_param"
  }
  if (/Bad Request|invalid_request/i.test(s)) {
    return "bad_request"
  }
  return s.slice(0, 80)
}

function isEmptyMessagesHint(hint: string | undefined): boolean {
  return hint === "llm_empty_messages" || hint === "invalid_file_param"
}

function buildWorkflowFailedFinding(hint?: string): DifyCheckResult {
  const isEmptyMessages = hint === "llm_empty_messages"
  const finding = isEmptyMessages
    ? {
        severity: "mid",
        title: CHECK_UI.summaryUnreadable,
        description:
          "AIモデルへ渡す内容（文章または画像）が空だったため点検できませんでした。開始ノードに document_image（ファイルリスト）を追加し、LLM の Vision に document_image を接続して公開してください。",
        basis: "システム",
        suggestion:
          "Dify 開始ノードに変数 document_image（ファイルリスト・必須オフ）を追加 → Vision に document_image を設定 → ワークフローを再公開してください。",
      }
    : buildFallbackFinding()

  if (!isEmptyMessages && hint) {
    finding.description = `${finding.description}\n（詳細コード: ${hint}）`
  }

  return {
    findings: [finding],
    rawText: hint ?? "",
    parseOk: false,
    usedFallback: true,
  }
}

async function postWorkflowOnce(options: {
  baseUrl: string
  apiKey: string
  body: WorkflowRequestBody
  attempt: number
  withoutFiles: boolean
  repairTexts: string[]
}): Promise<WorkflowAttemptResult> {
  const { baseUrl, apiKey, body, attempt, withoutFiles, repairTexts } = options

  const res = await fetch(`${baseUrl}/v1/workflows/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()

  if (!res.ok) {
    const hint = sanitizeErrorHint(text)
    logDifyDiag({
      attempt,
      httpStatus: res.status,
      errorKind: "http_error",
      answerLength: text.length,
      errorHint: hint,
      withoutFiles,
    })
    repairTexts.push(text)
    if (isEmptyMessagesHint(hint)) {
      return { kind: "empty_messages", raw: text, hint: hint! }
    }
    return { kind: "continue", raw: text, hint }
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
      withoutFiles,
    })
    repairTexts.push(text)
    return { kind: "continue", raw: text }
  }

  const workflowStatus = payload.data?.status
  const workflowError = payload.data?.error
  const outputKeys = payload.data?.outputs
    ? Object.keys(payload.data.outputs)
    : []

  if (workflowStatus === "failed" || workflowError) {
    const hint = sanitizeErrorHint(workflowError ?? text)
    logDifyDiag({
      attempt,
      httpStatus: res.status,
      workflowStatus,
      outputKeys,
      errorKind: "workflow_failed",
      errorHint: hint,
      withoutFiles,
    })
    if (isEmptyMessagesHint(hint)) {
      return { kind: "empty_messages", raw: text, hint: hint ?? "llm_empty_messages" }
    }
    return {
      kind: "ok",
      result: buildWorkflowFailedFinding(hint),
    }
  }

  const answer = pickAnswerText(payload)
  const parsed = parseWithRetryAndFallback(answer, repairTexts)

  logDifyDiag({
    attempt,
    httpStatus: res.status,
    workflowStatus,
    outputKeys,
    answerLength: answer.length,
    parseOk: parsed.parseOk,
    usedFallback: parsed.usedFallback,
    errorKind: parsed.usedFallback
      ? parsed.parseOk
        ? "fallback"
        : "parse_failed"
      : undefined,
    withoutFiles,
  })

  return { kind: "ok", result: parsed }
}

/**
 * Dify Workflow へチェック依頼を送る。
 * APIキーはサーバー環境変数のみ。クライアントに露出しない。
 *
 * Workflow 入力変数:
 * - document_text / prefecture / municipality / doc_type / national
 * - 画像は File Upload 後、top-level の files[]（variable = DIFY_FILE_INPUT_KEY、既定 document_image）
 * - 空 messages エラー時は files なしで1回だけ再試行する
 */
export async function runDifyCheck(
  input: DifyCheckInput
): Promise<DifyCheckResult> {
  const decision = decideMockMode({ mockScenario: input.mockScenario })

  if (decision.mock) {
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
  const hasImage = Boolean(input.imageBase64)

  const inputs: Record<string, string> = {
    document_text: ensureDocumentText(input.documentText, hasImage),
    prefecture: input.prefecture || "",
    municipality: input.municipality || "",
    doc_type: input.docType || "その他",
    national: input.national || "1",
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
      hasVisionFile = true
    } catch (err) {
      console.error("[dify] vision_file_skip", {
        errorKind: err instanceof Error ? err.name : "unknown",
        message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      })
    }
  }

  const bodyWithFiles: WorkflowRequestBody = {
    inputs,
    response_mode: "blocking",
    user: DIFY_CHECK_USER,
  }
  if (visionMappings.length > 0) {
    bodyWithFiles.files = visionMappings.map((m) => ({
      ...m,
      variable: fileInputKey,
    }))
  }

  console.error("[dify] invoke_live", {
    baseUrl,
    hasKey: Boolean(apiKey),
    keyPrefix: apiKey.slice(0, 4),
    textLength: inputs.document_text.length,
    hasImage,
    hasVisionFile,
    fileInputKey,
    filesCount: bodyWithFiles.files?.length ?? 0,
    docType: input.docType,
    national: input.national,
  })

  const repairTexts: string[] = []
  const first = await postWorkflowOnce({
    baseUrl,
    apiKey,
    body: bodyWithFiles,
    attempt: 1,
    withoutFiles: false,
    repairTexts,
  })

  if (first.kind === "ok") {
    return first.result
  }

  // 空 messages / 不正ファイル → files なしで1回だけ再試行
  if (
    first.kind === "empty_messages" &&
    bodyWithFiles.files &&
    bodyWithFiles.files.length > 0
  ) {
    console.error("[dify] retry_without_files", {
      reason: first.hint,
      fileInputKey,
    })
    const bodyTextOnly: WorkflowRequestBody = {
      inputs,
      response_mode: "blocking",
      user: DIFY_CHECK_USER,
    }
    const second = await postWorkflowOnce({
      baseUrl,
      apiKey,
      body: bodyTextOnly,
      attempt: 2,
      withoutFiles: true,
      repairTexts,
    })
    if (second.kind === "ok") {
      return second.result
    }
    if (second.kind === "empty_messages") {
      return buildWorkflowFailedFinding(second.hint)
    }
    // continue → 通常リトライへ
  } else if (first.kind === "empty_messages") {
    return buildWorkflowFailedFinding(first.hint)
  }

  // 通常の追加リトライ（files 付きのまま、ネットワーク等）
  let lastRaw = first.raw
  for (let attempt = 2; attempt <= 3; attempt++) {
    try {
      const next = await postWorkflowOnce({
        baseUrl,
        apiKey,
        body: bodyWithFiles,
        attempt,
        withoutFiles: false,
        repairTexts,
      })
      if (next.kind === "ok") return next.result
      if (next.kind === "empty_messages") {
        if (bodyWithFiles.files?.length) {
          console.error("[dify] retry_without_files", {
            reason: next.hint,
            fileInputKey,
            fromAttempt: attempt,
          })
          const textOnly = await postWorkflowOnce({
            baseUrl,
            apiKey,
            body: {
              inputs,
              response_mode: "blocking",
              user: DIFY_CHECK_USER,
            },
            attempt: attempt + 1,
            withoutFiles: true,
            repairTexts,
          })
          if (textOnly.kind === "ok") return textOnly.result
          if (textOnly.kind === "empty_messages") {
            return buildWorkflowFailedFinding(textOnly.hint)
          }
          lastRaw = textOnly.raw
        } else {
          return buildWorkflowFailedFinding(next.hint)
        }
      } else {
        lastRaw = next.raw
      }
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

  const hint = sanitizeErrorHint(lastRaw)
  if (isEmptyMessagesHint(hint)) {
    return buildWorkflowFailedFinding(hint)
  }

  const fallback = parseWithRetryAndFallback(lastRaw || "{}", repairTexts)
  logDifyDiag({
    attempt: 3,
    parseOk: fallback.parseOk,
    usedFallback: fallback.usedFallback,
    errorKind: "exhausted_retries",
    errorHint: hint,
  })
  return fallback
}
