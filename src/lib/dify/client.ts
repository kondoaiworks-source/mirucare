import { runMockDifyCheck } from "./mock"
import { buildFallbackFinding, parseWithRetryAndFallback } from "./parse"
import {
  decideMockMode,
  getDifyApiKey,
  getDifyBaseUrl,
  isProductionRuntime,
} from "./env"
import {
  buildStructuredDifyError,
  isEmptyMessagesHint,
  isFatalDifyConfigHint,
  isFileParamHint,
  parseDifyErrorBody,
  sanitizeErrorHint,
  type StructuredDifyError,
} from "./errors"
import {
  DIFY_CHECK_USER,
  getDifyFileInputKey,
  uploadBase64AsDifyFile,
  type DifyFileMapping,
} from "./files"
import type { DifyCheckInput, DifyCheckResult } from "./types"
import {
  buildDifyWorkflowInputs,
  logDifyRequestPayloadCheck,
  type DifyWorkflowInputs,
} from "./workflow-payload"
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
  inputs: DifyWorkflowInputs
  response_mode: "blocking"
  user: string
}

type WorkflowAttemptResult =
  | { kind: "ok"; result: DifyCheckResult }
  | { kind: "retry_without_files"; raw: string; hint: string }
  | { kind: "config_error"; raw: string; hint: string; errorInfo?: StructuredDifyError }
  | { kind: "transient"; raw: string; hint?: string; errorInfo: StructuredDifyError }
  | { kind: "fatal"; raw: string; hint?: string; errorInfo: StructuredDifyError }

const MAX_WORKFLOW_ATTEMPTS = 3
const TRANSIENT_BACKOFF_MS = [3000, 6000] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withAttemptMeta(
  result: DifyCheckResult,
  attempts: number,
  errorInfo?: StructuredDifyError
): DifyCheckResult {
  return {
    ...result,
    attempts,
    ...(errorInfo ? { errorInfo } : {}),
  }
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

const PLUGIN_INVOKE_ERROR = /PluginInvokeError/i
/** traceback 末尾まで確認できる十分な長さ（ログ肥大化防止の上限） */
const LOG_RAW_ERROR_MAX = 16_000

function isPluginInvokeError(raw: string | undefined): boolean {
  return Boolean(raw && PLUGIN_INVOKE_ERROR.test(raw))
}

function extractReqIdFromRaw(raw: string): string | undefined {
  const match = raw.match(/req_id:\s*([a-f0-9]+)/i)
  return match?.[1]
}

/** APIキー・Authorization 等をマスク（サーバーログ用） */
function redactSecretsForLog(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/(api[_-]?key|authorization)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/\bapp-[A-Za-z0-9]+\b/g, "app-[REDACTED]")
    .replace(/\bsk-[A-Za-z0-9]{10,}\b/g, "sk-[REDACTED]")
}

function prepareRawErrorForLog(raw: string): string {
  const redacted = redactSecretsForLog(raw)
  if (redacted.length <= LOG_RAW_ERROR_MAX) return redacted
  const omitted = redacted.length - LOG_RAW_ERROR_MAX
  return `...[truncated ${omitted} chars]...\n${redacted.slice(-LOG_RAW_ERROR_MAX)}`
}

type DifyErrorDiagContext = {
  attempt: number
  httpStatus?: number
  workflowStatus?: string
  outputKeys?: string[]
  answerLength?: number
  errorKind: string
  errorHint?: string
  errorCode?: string
  errorMessage?: string
  withoutFiles?: boolean
  rawError: string
}

function logDifyErrorDiag(context: DifyErrorDiagContext): void {
  const rawError = prepareRawErrorForLog(context.rawError)
  logDifyDiag({
    attempt: context.attempt,
    httpStatus: context.httpStatus,
    workflowStatus: context.workflowStatus,
    outputKeys: context.outputKeys,
    answerLength: context.answerLength,
    errorKind: context.errorKind,
    errorHint: context.errorHint,
    errorCode: context.errorCode,
    errorMessage: context.errorMessage,
    withoutFiles: context.withoutFiles,
    rawError,
    rawErrorLength: context.rawError.length,
  })
  if (isPluginInvokeError(context.rawError)) {
    console.error("[dify] plugin_invoke_error", {
      attempt: context.attempt,
      httpStatus: context.httpStatus,
      workflowStatus: context.workflowStatus,
      errorCode: context.errorCode,
      errorMessage: context.errorMessage,
      errorHint: context.errorHint,
      withoutFiles: context.withoutFiles,
      reqId: extractReqIdFromRaw(context.rawError),
      rawError,
      rawErrorLength: context.rawError.length,
    })
  }
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
  errorCode?: string
  errorMessage?: string
  withoutFiles?: boolean
  rawError?: string
  rawErrorLength?: number
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
    errorCode: info.errorCode,
    errorMessage: info.errorMessage,
    withoutFiles: info.withoutFiles,
    ...(info.rawError !== undefined
      ? { rawError: info.rawError, rawErrorLength: info.rawErrorLength }
      : {}),
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

type WorkflowFailureClass = "config_error" | "retry_without_files" | "default"

function classifyWorkflowFailure(
  hint: string | undefined,
  sentFiles: boolean
): WorkflowFailureClass {
  if (isFatalDifyConfigHint(hint)) return "config_error"
  if (isFileParamHint(hint) || isEmptyMessagesHint(hint)) {
    return sentFiles ? "retry_without_files" : "config_error"
  }
  return "default"
}

function buildWorkflowFailedFinding(hint?: string): DifyCheckResult {
  if (hint === "llm_empty_messages") {
    return {
      findings: [
        {
          severity: "mid",
          title: CHECK_UI.summaryUnreadable,
          description:
            "AIモデルへ渡す内容（文章または画像）が空だったため点検できませんでした。開始ノードの document_text に本文が届いているか、画像点検時は document_image（任意のファイルリスト）が Vision に接続されているかご確認ください。",
          basis: "システム",
          suggestion:
            "Dify 開始ノードで document_image を必須オフにし、テキストだけで実行できることを確認してからワークフローを再公開してください。",
        },
      ],
      rawText: hint,
      parseOk: false,
      usedFallback: true,
    }
  }

  if (hint === "model_not_configured") {
    return {
      findings: [
        {
          severity: "mid",
          title: CHECK_UI.summaryFallback,
          description:
            "Dify ワークフローの AI モデルが未設定の可能性があるため点検できませんでした。LLM ノードでモデルを選び、ワークフローを再公開したうえでご確認ください。",
          basis: "システム",
          suggestion:
            "Dify の対象アプリ → LLM ノードでモデルと API キーを設定し、公開し直してください。ファイルの有無とは別の設定です。",
        },
      ],
      rawText: hint,
      parseOk: false,
      usedFallback: true,
    }
  }

  if (hint === "invalid_file_param") {
    return {
      findings: [
        {
          severity: "mid",
          title: CHECK_UI.summaryFallback,
          description:
            "Dify のファイル入力（document_image）の形式をご確認ください。CSVや文字入りPDFはテキストだけで点検し、ファイル未指定のときは document_image を送らない想定です。開始ノードでは任意入力にしてください。",
          basis: "システム",
          suggestion:
            "Dify 開始ノードの document_image をファイルリスト・必須オフにし、空の配列や空文字をデフォルトにしないで再公開してください。",
        },
      ],
      rawText: hint,
      parseOk: false,
      usedFallback: true,
    }
  }

  const finding = buildFallbackFinding()
  if (hint) {
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
    const parsedError = parseDifyErrorBody(text)
    const hint = sanitizeErrorHint(text)
    const sentFiles = Object.keys(body.inputs).some((key) =>
      Array.isArray(body.inputs[key])
    )
    const errorInfo = buildStructuredDifyError({
      raw: text,
      httpStatus: res.status,
      hint,
      errorKind: "http_error",
    })
    logDifyErrorDiag({
      attempt,
      httpStatus: res.status,
      errorKind: "http_error",
      answerLength: text.length,
      errorHint: hint,
      errorCode: parsedError.code,
      errorMessage: parsedError.message?.slice(0, 120),
      withoutFiles,
      rawError: text,
    })
    repairTexts.push(text)
    const kind = classifyWorkflowFailure(hint, sentFiles)
    if (kind === "retry_without_files") {
      return { kind, raw: text, hint: hint ?? "invalid_file_param" }
    }
    if (kind === "config_error") {
      return {
        kind,
        raw: text,
        hint: hint ?? "bad_request",
        errorInfo,
      }
    }
    if (errorInfo.retryable) {
      return { kind: "transient", raw: text, hint, errorInfo }
    }
    return { kind: "fatal", raw: text, hint, errorInfo }
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
      rawError: prepareRawErrorForLog(text),
      rawErrorLength: text.length,
    })
    repairTexts.push(text)
    return {
      kind: "fatal",
      raw: text,
      errorInfo: buildStructuredDifyError({
        raw: text,
        httpStatus: res.status,
        errorKind: "workflow_failed",
      }),
    }
  }

  const workflowStatus = payload.data?.status
  const workflowError = payload.data?.error
  const outputKeys = payload.data?.outputs
    ? Object.keys(payload.data.outputs)
    : []

  if (workflowStatus === "failed" || workflowError) {
    const parsedError = parseDifyErrorBody(workflowError ?? text)
    const hint = sanitizeErrorHint(workflowError ?? text)
    const errorInfo = buildStructuredDifyError({
      raw: workflowError ?? text,
      httpStatus: res.status,
      hint,
      errorKind: "workflow_failed",
    })
    logDifyErrorDiag({
      attempt,
      httpStatus: res.status,
      workflowStatus,
      outputKeys,
      errorKind: "workflow_failed",
      errorHint: hint,
      errorCode: parsedError.code,
      errorMessage: parsedError.message?.slice(0, 120),
      withoutFiles,
      rawError: workflowError ?? text,
    })
    const sentFiles = Object.keys(body.inputs).some((key) =>
      Array.isArray(body.inputs[key])
    )
    const kind = classifyWorkflowFailure(hint, sentFiles)
    if (kind === "retry_without_files") {
      return { kind, raw: text, hint: hint ?? "llm_empty_messages" }
    }
    if (kind === "config_error") {
      return {
        kind,
        raw: text,
        hint: hint ?? "workflow_failed",
        errorInfo,
      }
    }
    if (errorInfo.retryable) {
      repairTexts.push(text)
      return { kind: "transient", raw: text, hint, errorInfo }
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
 * - document_text / prefecture / municipality / doc_type / document_type / national
 * - approved_rules_json / regulatory_basis_json / check_as_of（任意・未定義でも動く想定）
 * - 画像があるときだけ inputs[document_image] に有効な File Upload 結果を載せる
 * - CSV・文字入りPDFは document_image をキーごと送らない
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

  let visionMappings: DifyFileMapping[] = []
  if (input.imageBase64) {
    try {
      const mapping = await uploadBase64AsDifyFile({
        imageBase64: input.imageBase64,
        mimeType: input.imageMimeType ?? "image/png",
        fileName: `check.${(input.imageMimeType ?? "image/png").includes("png") ? "png" : "jpg"}`,
      })
      visionMappings = [mapping]
    } catch (err) {
      console.error("[dify] vision_file_skip", {
        errorKind: err instanceof Error ? err.name : "unknown",
        message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      })
    }
  }

  const inputsWithFiles = buildDifyWorkflowInputs({
    documentText: ensureDocumentText(input.documentText, hasImage),
    prefecture: input.prefecture,
    municipality: input.municipality,
    docType: input.docType,
    national: input.national,
    approvedRulesJson: input.approvedRulesJson,
    regulatoryBasisJson: input.regulatoryBasisJson,
    checkAsOf: input.checkAsOf,
    fileInputKey,
    files: visionMappings,
  })
  const hasVisionFile = Array.isArray(inputsWithFiles[fileInputKey])
  const filesCount = hasVisionFile
    ? (inputsWithFiles[fileInputKey] as DifyFileMapping[]).length
    : 0

  const bodyWithFiles: WorkflowRequestBody = {
    inputs: inputsWithFiles,
    response_mode: "blocking",
    user: DIFY_CHECK_USER,
  }

  logDifyRequestPayloadCheck({
    inputs: inputsWithFiles,
    fileInputKey,
  })
  console.error("[dify] invoke_live", {
    baseUrl,
    hasKey: Boolean(apiKey),
    keyPrefix: apiKey.slice(0, 4),
    textLength:
      typeof inputsWithFiles.document_text === "string"
        ? inputsWithFiles.document_text.length
        : 0,
    hasImage,
    hasVisionFile,
    fileInputKey,
    filesCount,
    hasDocumentImageKey: fileInputKey in inputsWithFiles,
    inputKeys: Object.keys(inputsWithFiles),
    docType: input.docType,
    national: input.national,
  })

  const repairTexts: string[] = []
  let attempts = 0
  let lastTransientError: StructuredDifyError | undefined
  let lastHint: string | undefined

  const textOnlyInputs = buildDifyWorkflowInputs({
    documentText: ensureDocumentText(input.documentText, hasImage),
    prefecture: input.prefecture,
    municipality: input.municipality,
    docType: input.docType,
    national: input.national,
    approvedRulesJson: input.approvedRulesJson,
    regulatoryBasisJson: input.regulatoryBasisJson,
    checkAsOf: input.checkAsOf,
    fileInputKey,
    files: [],
  })
  const bodyTextOnly: WorkflowRequestBody = {
    inputs: textOnlyInputs,
    response_mode: "blocking",
    user: DIFY_CHECK_USER,
  }

  let currentBody = bodyWithFiles
  let withoutFiles = filesCount === 0

  async function invokeWorkflow(): Promise<WorkflowAttemptResult> {
    attempts++
    try {
      return await postWorkflowOnce({
        baseUrl,
        apiKey,
        body: currentBody,
        attempt: attempts,
        withoutFiles,
        repairTexts,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "network_error"
      const errorInfo = buildStructuredDifyError({
        raw: message,
        errorKind: "network_error",
      })
      logDifyDiag({
        attempt: attempts,
        errorKind: "network_or_throw",
        answerLength: message.length,
      })
      repairTexts.push(message)
      if (errorInfo.retryable) {
        return { kind: "transient", raw: message, errorInfo }
      }
      return { kind: "fatal", raw: message, errorInfo }
    }
  }

  function finishFatal(hint?: string, errorInfo?: StructuredDifyError): DifyCheckResult {
    return withAttemptMeta(
      buildWorkflowFailedFinding(hint),
      attempts,
      errorInfo ?? lastTransientError
    )
  }

  async function handleAttemptResult(
    result: WorkflowAttemptResult
  ): Promise<DifyCheckResult | "backoff"> {
    if (result.kind === "ok") {
      return withAttemptMeta(result.result, attempts, lastTransientError)
    }
    if (result.kind === "config_error" || result.kind === "fatal") {
      return finishFatal(result.hint, result.errorInfo)
    }
    if (result.kind === "retry_without_files" && filesCount > 0 && !withoutFiles) {
      console.error("[dify] retry_without_files", {
        reason: result.hint,
        fileInputKey,
      })
      currentBody = bodyTextOnly
      withoutFiles = true
      const retryResult = await invokeWorkflow()
      if (retryResult.kind === "ok") {
        return withAttemptMeta(retryResult.result, attempts)
      }
      if (retryResult.kind === "config_error" || retryResult.kind === "fatal") {
        return finishFatal(retryResult.hint, retryResult.errorInfo)
      }
      if (retryResult.kind === "retry_without_files") {
        return finishFatal(retryResult.hint)
      }
      if (retryResult.kind === "transient") {
        lastTransientError = retryResult.errorInfo
        lastHint = retryResult.hint
        return "backoff"
      }
    }
    if (result.kind === "transient") {
      lastTransientError = result.errorInfo
      lastHint = result.hint
      return "backoff"
    }
    return finishFatal(lastHint)
  }

  for (let tryIndex = 0; tryIndex < MAX_WORKFLOW_ATTEMPTS; tryIndex++) {
    const result = await invokeWorkflow()
    const handled = await handleAttemptResult(result)
    if (handled !== "backoff") {
      return handled
    }
    if (tryIndex >= MAX_WORKFLOW_ATTEMPTS - 1) {
      logDifyDiag({
        attempt: attempts,
        usedFallback: true,
        errorKind: "exhausted_retries",
        errorHint: lastHint,
      })
      return finishFatal(lastHint, lastTransientError)
    }

    const waitMs = TRANSIENT_BACKOFF_MS[tryIndex] ?? TRANSIENT_BACKOFF_MS.at(-1)!
    console.error("[dify] transient_backoff", {
      attempt: attempts,
      waitMs,
      errorKind: lastTransientError?.errorKind,
      statusCode: lastTransientError?.statusCode,
      reqId: lastTransientError?.reqId,
      retryable: lastTransientError?.retryable,
    })
    await sleep(waitMs)
  }

  return finishFatal(lastHint, lastTransientError)
}
