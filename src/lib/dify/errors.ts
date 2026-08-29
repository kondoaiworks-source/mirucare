/**
 * Dify HTTP エラー本文の分類。
 * code の invalid_param だけを見て file エラーと決めないこと。
 */

export type StructuredDifyError = {
  errorKind: "http_error" | "workflow_failed" | "network_error"
  errorType?: string
  statusCode?: number
  reqId?: string
  retryable: boolean
}

const TRANSIENT_HTTP_STATUSES = new Set([429, 500, 502, 503, 504])
const NON_RETRYABLE_HTTP_STATUSES = new Set([400, 401, 403, 404])

const TRANSIENT_PATTERNS = [
  /\b429\b/,
  /\b500\b/,
  /\b502\b/,
  /\b503\b/,
  /\b504\b/,
  /\bUNAVAILABLE\b/i,
  /\bServerError\b/,
  /\bTimeout\b/i,
  /\bReadTimeout\b/i,
  /\bConnectionError\b/i,
  /\bhigh demand\b/i,
  /\brate limit\b/i,
] as const

const ERROR_TYPE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\bServerError\b/i, type: "ServerError" },
  { pattern: /\bReadTimeout\b/i, type: "ReadTimeout" },
  { pattern: /\bConnectionError\b/i, type: "ConnectionError" },
  { pattern: /\bTimeout\b/i, type: "Timeout" },
]

export function parseDifyErrorBody(raw: string | undefined): {
  code?: string
  message?: string
} {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as { code?: unknown; message?: unknown }
    return {
      code: typeof parsed.code === "string" ? parsed.code : undefined,
      message:
        typeof parsed.message === "string" ? parsed.message : undefined,
    }
  } catch {
    return { message: raw.replace(/\s+/g, " ").trim().slice(0, 180) }
  }
}

export function sanitizeErrorHint(raw: string | undefined): string | undefined {
  const { code, message } = parseDifyErrorBody(raw)
  const blob = `${code ?? ""} ${message ?? raw ?? ""}`.replace(/\s+/g, " ").trim()
  if (!blob) return undefined

  if (/at least one message is required/i.test(blob)) {
    return "llm_empty_messages"
  }
  if (/Model is not configured/i.test(blob)) {
    return "model_not_configured"
  }
  if (
    /must be a (file|list of files)|invalid_file_param/i.test(blob) ||
    (code === "invalid_param" && /file/i.test(message ?? ""))
  ) {
    return "invalid_file_param"
  }
  if (/is required in input form/i.test(blob)) {
    return "missing_required_input"
  }
  if (code === "invalid_param" && message) {
    return `invalid_param:${message.replace(/\s+/g, " ").trim().slice(0, 80)}`
  }
  if (/Bad Request|invalid_request/i.test(blob)) {
    return "bad_request"
  }
  return blob.slice(0, 80)
}

export function isFileParamHint(hint: string | undefined): boolean {
  return hint === "invalid_file_param"
}

export function isEmptyMessagesHint(hint: string | undefined): boolean {
  return hint === "llm_empty_messages"
}

export function isFatalDifyConfigHint(hint: string | undefined): boolean {
  return (
    hint === "model_not_configured" || hint === "missing_required_input"
  )
}

function isNonRetryableHint(hint: string | undefined): boolean {
  if (!hint) return false
  if (
    hint === "bad_request" ||
    hint === "model_not_configured" ||
    hint === "missing_required_input" ||
    hint === "invalid_file_param" ||
    hint === "llm_empty_messages"
  ) {
    return true
  }
  return hint.startsWith("invalid_param")
}

function extractReqId(blob: string): string | undefined {
  const match = blob.match(/req_id:\s*([a-f0-9]+)/i)
  return match?.[1]
}

function extractStatusCode(blob: string, httpStatus?: number): number | undefined {
  if (httpStatus !== undefined && httpStatus >= 400) return httpStatus
  const match = blob.match(/\b(429|500|502|503|504)\b/)
  return match ? Number(match[1]) : undefined
}

function extractErrorType(blob: string): string | undefined {
  for (const { pattern, type } of ERROR_TYPE_PATTERNS) {
    if (pattern.test(blob)) return type
  }
  return undefined
}

/**
 * 一時的（transient）な Dify / プラグインエラーかどうか。
 * 400・invalid_param 等は再試行しない。
 */
export function isTransientDifyError(options: {
  raw?: string
  httpStatus?: number
  hint?: string
}): boolean {
  const { raw, httpStatus, hint } = options
  if (isFatalDifyConfigHint(hint) || isNonRetryableHint(hint)) {
    return false
  }

  const blob = `${raw ?? ""} ${hint ?? ""}`.replace(/\s+/g, " ").trim()
  const status = extractStatusCode(blob, httpStatus)

  if (status !== undefined && NON_RETRYABLE_HTTP_STATUSES.has(status)) {
    return false
  }
  if (status !== undefined && TRANSIENT_HTTP_STATUSES.has(status)) {
    return true
  }
  if (httpStatus !== undefined && TRANSIENT_HTTP_STATUSES.has(httpStatus)) {
    return true
  }

  if (/Bad Request|invalid_request/i.test(blob)) {
    return false
  }

  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(blob))
}

export function buildStructuredDifyError(options: {
  raw?: string
  httpStatus?: number
  hint?: string
  errorKind: StructuredDifyError["errorKind"]
}): StructuredDifyError {
  const blob = `${options.raw ?? ""} ${options.hint ?? ""}`
    .replace(/\s+/g, " ")
    .trim()
  const statusCode = extractStatusCode(blob, options.httpStatus)
  const retryable = isTransientDifyError({
    raw: options.raw,
    httpStatus: options.httpStatus,
    hint: options.hint,
  })

  return {
    errorKind: options.errorKind,
    errorType: extractErrorType(blob),
    statusCode,
    reqId: extractReqId(blob),
    retryable,
  }
}
