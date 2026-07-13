/**
 * ユーザー向けエラーメッセージ（原因＋対処）
 * ログには個人名・被保険者番号を含めない
 */
function extractErrorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const record = error as {
      message?: unknown
      error_description?: unknown
      details?: unknown
      code?: unknown
    }
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message
    }
    if (
      typeof record.error_description === "string" &&
      record.error_description.trim()
    ) {
      return record.error_description
    }
    if (typeof record.details === "string" && record.details.trim()) {
      return record.details
    }
  }
  return ""
}

export function toUserErrorMessage(error: unknown, fallback?: string): string {
  const message = extractErrorText(error)
  const normalized = message.toLowerCase()

  if (
    normalized.includes("invalid login") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("email not confirmed")
  ) {
    return "メールアドレスまたはパスワードが正しくありません。入力内容をご確認ください。"
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already been registered")
  ) {
    return "このメールアドレスはすでに登録されています。ログイン画面からお進みください。"
  }

  if (
    normalized.includes("password") &&
    (normalized.includes("least") || normalized.includes("short"))
  ) {
    return "パスワードが短すぎます。8文字以上で設定してください。"
  }

  if (normalized.includes("email") && normalized.includes("invalid")) {
    return "メール形式が正しくありません。@マークが含まれているかご確認ください。"
  }

  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "操作が集中しています。しばらく待ってから再度お試しください。"
  }

  if (
    normalized.includes("row-level security") ||
    normalized.includes("violates row-level security") ||
    normalized.includes("permission denied") ||
    normalized.includes("42501")
  ) {
    return "この操作を行う権限がありません。ログイン状態をご確認ください。"
  }

  if (
    normalized.includes("jwt") ||
    normalized.includes("session") ||
    normalized.includes("not authenticated")
  ) {
    return "ログインの有効期限が切れた可能性があります。再度ログインしてください。"
  }

  if (message.includes("すでに事業所に所属")) {
    return message
  }

  if (message.includes("招待")) {
    return message
  }

  if (message.includes("事業所名")) {
    return message
  }

  if (message.includes("ログインが必要")) {
    return "ログインの有効期限が切れた可能性があります。再度ログインしてください。"
  }

  return (
    fallback ??
    "処理に失敗しました。通信状況をご確認のうえ、再度お試しください。"
  )
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim()
  if (!trimmed) {
    return "メールアドレスを入力してください。未入力のままでは進められません。"
  }
  if (!trimmed.includes("@") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "メール形式が正しくありません。@マークが含まれているかご確認ください。"
  }
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return "パスワードを入力してください。未入力のままでは進められません。"
  }
  if (password.length < 8) {
    return "パスワードが短すぎます。8文字以上で設定してください。"
  }
  return null
}
