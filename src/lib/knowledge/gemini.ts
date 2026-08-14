/**
 * Gemini API（サーバーサイド専用）。キーは環境変数のみ。
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash"
const RETRY_WAIT_MS = 60_000

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

export type GeminiGenerateResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; model: string }

async function callGeminiOnce(
  prompt: string,
  model: string,
  apiKey: string,
  timeoutMs = 120_000
): Promise<GeminiGenerateResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    })
  } catch (err) {
    return {
      ok: false,
      model,
      error:
        err instanceof Error
          ? `Gemini通信エラー: ${err.message.slice(0, 160)}`
          : "Gemini通信エラー",
    }
  }

  if (!response.ok) {
    const body = (await response.text()).slice(0, 200)
    return {
      ok: false,
      model,
      error: `Gemini HTTP ${response.status}: ${body}`,
    }
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }
  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim()

  if (!text) {
    return { ok: false, model, error: "Gemini応答が空でした。" }
  }

  return { ok: true, text, model }
}

/**
 * 1回失敗 → 1分待機 → 1回リトライ。それでも失敗なら ok:false。
 */
export async function generateGeminiJson(
  prompt: string,
  opts?: { retry?: boolean; timeoutMs?: number }
): Promise<GeminiGenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  const model = getGeminiModel()
  if (!apiKey) {
    return { ok: false, model, error: "GEMINI_API_KEY 未設定" }
  }

  const first = await callGeminiOnce(prompt, model, apiKey, opts?.timeoutMs)
  if (first.ok) return first

  console.error("[gemini] first_attempt_failed", {
    model,
    error: first.error.slice(0, 160),
  })

  if (opts?.retry === false) return first

  await new Promise((r) => setTimeout(r, RETRY_WAIT_MS))

  const second = await callGeminiOnce(
    prompt,
    model,
    apiKey,
    opts?.timeoutMs
  )
  if (!second.ok) {
    console.error("[gemini] retry_failed", {
      model,
      error: second.error.slice(0, 160),
    })
  }
  return second
}

/** テスト用に短い待機へ差し替え可能にする */
export const __geminiRetryWaitMsForTests = RETRY_WAIT_MS
