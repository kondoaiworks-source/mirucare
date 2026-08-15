/**
 * 公的サイト向け HTTP 取得（条件付きGET・間隔下限・連絡先付き UA）
 */

export const REQUEST_INTERVAL_FLOOR_SEC = 5
/** 省庁の大きいPDFを取るため（登録・再同期の待ち時間もこれに合わせる） */
export const FETCH_TIMEOUT_MS = 120_000

let lastRequestAtMs = 0

export function getKnowledgeSyncUserAgent(): string {
  const raw = process.env.KNOWLEDGE_SYNC_USER_AGENT?.trim()
  if (raw) return raw
  const contact =
    process.env.KNOWLEDGE_SYNC_CONTACT_EMAIL?.trim() ||
    process.env.OPERATOR_EMAILS?.split(",")[0]?.trim() ||
    "ops@example.com"
  return `MiruCare-KnowledgeSync/1.1 (contact: ${contact})`
}

export function getRequestIntervalMs(): number {
  const raw = Number(process.env.KNOWLEDGE_SYNC_INTERVAL_SEC ?? "")
  const sec =
    Number.isFinite(raw) && raw > 0 ? raw : REQUEST_INTERVAL_FLOOR_SEC
  return Math.max(REQUEST_INTERVAL_FLOOR_SEC, sec) * 1000
}

async function waitForRequestSlot(): Promise<void> {
  const interval = getRequestIntervalMs()
  const elapsed = Date.now() - lastRequestAtMs
  if (lastRequestAtMs > 0 && elapsed < interval) {
    await new Promise((r) => setTimeout(r, interval - elapsed))
  }
  lastRequestAtMs = Date.now()
}

export type ConditionalFetchResult =
  | { kind: "not_modified" }
  | {
      kind: "ok"
      response: Response
      etag: string | null
      lastModified: string | null
    }
  | { kind: "error"; status?: number; message: string }

/**
 * ETag / If-Modified-Since 付き GET。304 は not_modified。
 * 呼び出しごとに最低 REQUEST_INTERVAL_FLOOR_SEC 待機する。
 */
export async function conditionalFetch(
  url: string,
  opts: {
    etag?: string | null
    lastModified?: string | null
    accept?: string
  } = {}
): Promise<ConditionalFetchResult> {
  await waitForRequestSlot()

  const headers: Record<string, string> = {
    "User-Agent": getKnowledgeSyncUserAgent(),
    Accept: opts.accept ?? "*/*",
  }
  if (opts.etag?.trim()) {
    headers["If-None-Match"] = opts.etag.trim()
  }
  if (opts.lastModified?.trim()) {
    headers["If-Modified-Since"] = opts.lastModified.trim()
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers,
    })
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? `取得に失敗しました（${error.name}）。通信状況またはURLをご確認ください。`
          : "取得に失敗しました。URLをご確認ください。",
    }
  }

  if (response.status === 304) {
    return { kind: "not_modified" }
  }

  if (!response.ok) {
    return {
      kind: "error",
      status: response.status,
      message: `取得に失敗した可能性があります（HTTP ${response.status}）。URLをご確認ください。`,
    }
  }

  return {
    kind: "ok",
    response,
    etag: response.headers.get("ETag"),
    lastModified: response.headers.get("Last-Modified"),
  }
}

/** テスト用: リクエスト間隔タイマーをリセット */
export function resetRequestThrottleForTests(): void {
  lastRequestAtMs = 0
}
