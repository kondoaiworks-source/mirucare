import { runMockDifyCheck } from "./mock"
import { buildFallbackFinding, parseWithRetryAndFallback } from "./parse"
import {
  decideMockMode,
  getDifyApiKey,
  getDifyBaseUrl,
  isProductionRuntime,
} from "./env"
import {
  isEmptyMessagesHint,
  isFatalDifyConfigHint,
  isFileParamHint,
  parseDifyErrorBody,
  sanitizeErrorHint,
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
  | { kind: "config_error"; raw: string; hint: string }
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
  errorCode?: string
  errorMessage?: string
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
    errorCode: info.errorCode,
    errorMessage: info.errorMessage,
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

function classifyWorkflowFailure(
  hint: string | undefined,
  sentFiles: boolean
): Exclude<WorkflowAttemptResult, { kind: "ok" }>["kind"] {
  if (isFatalDifyConfigHint(hint)) return "config_error"
  if (isFileParamHint(hint) || isEmptyMessagesHint(hint)) {
    return sentFiles ? "retry_without_files" : "config_error"
  }
  return "continue"
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
    logDifyDiag({
      attempt,
      httpStatus: res.status,
      errorKind: "http_error",
      answerLength: text.length,
      errorHint: hint,
      errorCode: parsedError.code,
      errorMessage: parsedError.message?.slice(0, 120),
      withoutFiles,
    })
    repairTexts.push(text)
    const kind = classifyWorkflowFailure(hint, sentFiles)
    if (kind === "retry_without_files") {
      return { kind, raw: text, hint: hint ?? "invalid_file_param" }
    }
    if (kind === "config_error") {
      return { kind, raw: text, hint: hint ?? "bad_request" }
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
    const parsedError = parseDifyErrorBody(workflowError ?? text)
    const hint = sanitizeErrorHint(workflowError ?? text)
    logDifyDiag({
      attempt,
      httpStatus: res.status,
      workflowStatus,
      outputKeys,
      errorKind: "workflow_failed",
      errorHint: hint,
      errorCode: parsedError.code,
      errorMessage: parsedError.message?.slice(0, 120),
      withoutFiles,
    })
    const sentFiles = Object.keys(body.inputs).some((key) =>
      Array.isArray(body.inputs[key])
    )
    const kind = classifyWorkflowFailure(hint, sentFiles)
    if (kind === "retry_without_files") {
      return { kind, raw: text, hint: hint ?? "llm_empty_messages" }
    }
    if (kind === "config_error") {
      return { kind, raw: text, hint: hint ?? "workflow_failed" }
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
  const first = await postWorkflowOnce({
    baseUrl,
    apiKey,
    body: bodyWithFiles,
    attempt: 1,
    withoutFiles: filesCount === 0,
    repairTexts,
  })

  if (first.kind === "ok") {
    return first.result
  }
  if (first.kind === "config_error") {
    return buildWorkflowFailedFinding(first.hint)
  }

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

  if (first.kind === "retry_without_files" && filesCount > 0) {
    console.error("[dify] retry_without_files", {
      reason: first.hint,
      fileInputKey,
    })
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
    if (second.kind === "config_error" || second.kind === "retry_without_files") {
      return buildWorkflowFailedFinding(second.hint)
    }
  }

  let lastRaw = first.raw
  for (let attempt = 2; attempt <= 3; attempt++) {
    try {
      const next = await postWorkflowOnce({
        baseUrl,
        apiKey,
        body: bodyWithFiles,
        attempt,
        withoutFiles: filesCount === 0,
        repairTexts,
      })
      if (next.kind === "ok") return next.result
      if (next.kind === "config_error") {
        return buildWorkflowFailedFinding(next.hint)
      }
      if (next.kind === "retry_without_files" && filesCount > 0) {
        console.error("[dify] retry_without_files", {
          reason: next.hint,
          fileInputKey,
          fromAttempt: attempt,
        })
        const textOnly = await postWorkflowOnce({
          baseUrl,
          apiKey,
          body: bodyTextOnly,
          attempt: attempt + 1,
          withoutFiles: true,
          repairTexts,
        })
        if (textOnly.kind === "ok") return textOnly.result
        if (
          textOnly.kind === "config_error" ||
          textOnly.kind === "retry_without_files"
        ) {
          return buildWorkflowFailedFinding(textOnly.hint)
        }
        lastRaw = textOnly.raw
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
  if (
    isEmptyMessagesHint(hint) ||
    isFileParamHint(hint) ||
    isFatalDifyConfigHint(hint)
  ) {
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
