/**
 * Dify HTTP エラー本文の分類。
 * code の invalid_param だけを見て file エラーと決めないこと。
 */

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
