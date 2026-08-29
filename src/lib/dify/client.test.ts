import { afterEach, describe, expect, it, vi } from "vitest"
import { CHECK_UI } from "@/lib/copy/check-ui"

const SUCCESS_OUTPUT = JSON.stringify({ findings: [] })

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function workflowFailed503(reqId = "f298ca246d") {
  return jsonResponse({
    data: {
      status: "failed",
      error: `req_id: ${reqId} PluginInvokeError: {"args":{"description":"google.genai.errors.ServerError: 503 UNAVAILABLE This model is currently experiencing high demand."}}`,
    },
  })
}

describe("runDifyCheck の実payload", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it("テキストだけなら JSON に document_image も top-level files も無い", async () => {
    vi.stubEnv("DIFY_API_KEY", "app-test-key")
    vi.stubEnv("DIFY_MOCK", "0")
    vi.stubEnv("DIFY_BASE_URL", "https://api.dify.ai")
    vi.stubEnv("DIFY_FILE_INPUT_KEY", "document_image")
    vi.stubEnv("VERCEL_ENV", "preview")

    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: {
          status: "succeeded",
          outputs: { result: SUCCESS_OUTPUT },
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const { runDifyCheck } = await import("@/lib/dify/client")
    await runDifyCheck({
      municipality: "渋谷区",
      prefecture: "東京都",
      national: "0",
      docType: "提供記録",
      documentText:
        "サービス提供記録の確認用です。同意欄の日付が空欄の可能性をご確認ください。",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const payload = JSON.parse(String(init.body)) as {
      inputs: Record<string, unknown>
      files?: unknown
    }
    expect(payload.files).toBeUndefined()
    expect("document_image" in payload.inputs).toBe(false)
    expect(payload.inputs.document_image).toBeUndefined()
    expect(typeof payload.inputs.document_text).toBe("string")
    expect(String(payload.inputs.document_text).length).toBeGreaterThan(0)
    expect(payload.inputs.document_type).toBe("提供記録")
    expect(payload.inputs.doc_type).toBe("提供記録")
    expect(payload.inputs.national).toBe("0")
  })

  it("画像アップロード成功時だけ inputs.document_image に有効な配列を載せる", async () => {
    vi.stubEnv("DIFY_API_KEY", "app-test-key")
    vi.stubEnv("DIFY_MOCK", "0")
    vi.stubEnv("DIFY_BASE_URL", "https://api.dify.ai")
    vi.stubEnv("DIFY_FILE_INPUT_KEY", "document_image")
    vi.stubEnv("VERCEL_ENV", "preview")

    const fetchMock = vi.fn(async (...args: [string | URL, RequestInit?]) => {
      const [url] = args
      const href = String(url)
      if (href.endsWith("/v1/files/upload")) {
        return jsonResponse({ id: "upload-ok-1", mime_type: "image/jpeg" })
      }
      return jsonResponse({
        data: {
          status: "succeeded",
          outputs: { result: SUCCESS_OUTPUT },
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const { runDifyCheck } = await import("@/lib/dify/client")
    await runDifyCheck({
      municipality: "渋谷区",
      prefecture: "東京都",
      national: "0",
      docType: "提供記録",
      documentText: "画像をあわせてご確認ください。",
      imageBase64: Buffer.from("fake-jpeg").toString("base64"),
      imageMimeType: "image/jpeg",
    })

    const runCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/v1/workflows/run")
    )
    expect(runCall).toBeTruthy()
    const [, runInit] = runCall as unknown as [string | URL, RequestInit]
    const payload = JSON.parse(String(runInit.body)) as {
      inputs: Record<string, unknown>
      files?: unknown
    }
    expect(payload.files).toBeUndefined()
    expect(payload.inputs.document_image).toEqual([
      {
        type: "image",
        transfer_method: "local_file",
        upload_file_id: "upload-ok-1",
      },
    ])
  })

  it("503 workflow failed は最大3回まで再試行し、尽きたら Fallback", async () => {
    vi.stubEnv("DIFY_API_KEY", "app-test-key")
    vi.stubEnv("DIFY_MOCK", "0")
    vi.stubEnv("DIFY_BASE_URL", "https://api.dify.ai")
    vi.stubEnv("DIFY_FILE_INPUT_KEY", "document_image")
    vi.stubEnv("VERCEL_ENV", "preview")

    const fetchMock = vi.fn(async () => workflowFailed503())
    vi.stubGlobal("fetch", fetchMock)

    vi.useFakeTimers()

    const { runDifyCheck } = await import("@/lib/dify/client")
    const promise = runDifyCheck({
      municipality: "渋谷区",
      prefecture: "東京都",
      national: "0",
      docType: "提供記録",
      documentText: "テスト用の提供記録です。",
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.attempts).toBe(3)
    expect(result.usedFallback).toBe(true)
    expect(result.parseOk).toBe(false)
    expect(result.findings[0]?.title).toBe(CHECK_UI.summaryFallback)
    expect(result.errorInfo).toMatchObject({
      errorKind: "workflow_failed",
      errorType: "ServerError",
      statusCode: 503,
      reqId: "f298ca246d",
      retryable: true,
    })

    vi.useRealTimers()
  })

  it("503 1回の後に成功したら attempts=2", async () => {
    vi.stubEnv("DIFY_API_KEY", "app-test-key")
    vi.stubEnv("DIFY_MOCK", "0")
    vi.stubEnv("DIFY_BASE_URL", "https://api.dify.ai")
    vi.stubEnv("DIFY_FILE_INPUT_KEY", "document_image")
    vi.stubEnv("VERCEL_ENV", "preview")

    let call = 0
    const fetchMock = vi.fn(async () => {
      call++
      if (call === 1) return workflowFailed503()
      return jsonResponse({
        data: {
          status: "succeeded",
          outputs: { result: SUCCESS_OUTPUT },
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    vi.useFakeTimers()

    const { runDifyCheck } = await import("@/lib/dify/client")
    const promise = runDifyCheck({
      municipality: "渋谷区",
      prefecture: "東京都",
      national: "0",
      docType: "提供記録",
      documentText: "テスト用の提供記録です。",
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.attempts).toBe(2)
    expect(result.parseOk).toBe(true)
    expect(result.usedFallback).toBe(false)

    vi.useRealTimers()
  })

  it("503 の後に成功したら parseOk=true / usedFallback=false", async () => {
    vi.stubEnv("DIFY_API_KEY", "app-test-key")
    vi.stubEnv("DIFY_MOCK", "0")
    vi.stubEnv("DIFY_BASE_URL", "https://api.dify.ai")
    vi.stubEnv("DIFY_FILE_INPUT_KEY", "document_image")
    vi.stubEnv("VERCEL_ENV", "preview")

    let call = 0
    const fetchMock = vi.fn(async () => {
      call++
      if (call <= 2) return workflowFailed503(`req-${call}`)
      return jsonResponse({
        data: {
          status: "succeeded",
          outputs: { result: SUCCESS_OUTPUT },
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    vi.useFakeTimers()

    const { runDifyCheck } = await import("@/lib/dify/client")
    const promise = runDifyCheck({
      municipality: "渋谷区",
      prefecture: "東京都",
      national: "0",
      docType: "提供記録",
      documentText: "テスト用の提供記録です。",
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.attempts).toBe(3)
    expect(result.parseOk).toBe(true)
    expect(result.usedFallback).toBe(false)

    vi.useRealTimers()
  })

  it("429 は transient として再試行する", async () => {
    vi.stubEnv("DIFY_API_KEY", "app-test-key")
    vi.stubEnv("DIFY_MOCK", "0")
    vi.stubEnv("DIFY_BASE_URL", "https://api.dify.ai")
    vi.stubEnv("DIFY_FILE_INPUT_KEY", "document_image")
    vi.stubEnv("VERCEL_ENV", "preview")

    let call = 0
    const fetchMock = vi.fn(async () => {
      call++
      if (call <= 2) {
        return jsonResponse({ message: "rate limit exceeded" }, 429)
      }
      return jsonResponse({
        data: {
          status: "succeeded",
          outputs: { result: SUCCESS_OUTPUT },
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    vi.useFakeTimers()

    const { runDifyCheck } = await import("@/lib/dify/client")
    const promise = runDifyCheck({
      municipality: "渋谷区",
      prefecture: "東京都",
      national: "0",
      docType: "提供記録",
      documentText: "テスト用の提供記録です。",
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.attempts).toBe(3)
    expect(result.parseOk).toBe(true)
    expect(result.usedFallback).toBe(false)
    expect(result.errorInfo).toMatchObject({
      errorKind: "http_error",
      statusCode: 429,
      retryable: true,
    })

    vi.useRealTimers()
  })

  it("model_not_configured は再試行しない", async () => {
    vi.stubEnv("DIFY_API_KEY", "app-test-key")
    vi.stubEnv("DIFY_MOCK", "0")
    vi.stubEnv("DIFY_BASE_URL", "https://api.dify.ai")
    vi.stubEnv("DIFY_FILE_INPUT_KEY", "document_image")
    vi.stubEnv("VERCEL_ENV", "preview")

    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: {
          status: "failed",
          error: JSON.stringify({
            code: "invalid_param",
            message: "Model is not configured",
          }),
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const { runDifyCheck } = await import("@/lib/dify/client")
    const result = await runDifyCheck({
      municipality: "渋谷区",
      prefecture: "東京都",
      national: "0",
      docType: "提供記録",
      documentText: "テスト用の提供記録です。",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.attempts).toBe(1)
    expect(result.usedFallback).toBe(true)
    expect(result.findings[0]?.title).toBe(CHECK_UI.summaryFallback)
    expect(result.errorInfo?.retryable).toBe(false)
  })

  it("PluginInvokeError 時に traceback 末尾まで診断ログへ出力する", async () => {
    vi.stubEnv("DIFY_API_KEY", "app-test-key")
    vi.stubEnv("DIFY_MOCK", "0")
    vi.stubEnv("DIFY_BASE_URL", "https://api.dify.ai")
    vi.stubEnv("DIFY_FILE_INPUT_KEY", "document_image")
    vi.stubEnv("VERCEL_ENV", "preview")

    const tracebackTail = "KeyError: 'missing_field'"
    const traceback =
      `Traceback (most recent call last):\n  File "plugin.py", line 1\n` +
      "x".repeat(600) +
      `\n${tracebackTail}`
    const rawError = `req_id: a9ca3fc822 PluginInvokeError: {"args":{"traceback":${JSON.stringify(traceback)}}}`

    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: {
          status: "failed",
          error: rawError,
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const { runDifyCheck } = await import("@/lib/dify/client")
    const result = await runDifyCheck({
      municipality: "渋谷区",
      prefecture: "東京都",
      national: "0",
      docType: "提供記録",
      documentText: "テスト用の提供記録です。",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.usedFallback).toBe(true)

    const pluginLog = consoleSpy.mock.calls.find(
      ([msg]) => msg === "[dify] plugin_invoke_error"
    )
    expect(pluginLog).toBeTruthy()
    const payload = pluginLog![1] as Record<string, unknown>
    expect(payload.attempt).toBe(1)
    expect(payload.httpStatus).toBe(200)
    expect(payload.workflowStatus).toBe("failed")
    expect(payload.withoutFiles).toBe(true)
    expect(payload.reqId).toBe("a9ca3fc822")
    expect(String(payload.rawError)).toContain(tracebackTail)
    expect(String(payload.rawError)).not.toMatch(/Bearer\s+app-/)

    const checkLog = consoleSpy.mock.calls.find(([msg]) => msg === "[dify] check")
    expect(checkLog).toBeTruthy()
    expect(String((checkLog![1] as Record<string, unknown>).rawError)).toContain(
      tracebackTail
    )

    consoleSpy.mockRestore()
  })

  it("400 は即 Fallback（再試行しない）", async () => {
    vi.stubEnv("DIFY_API_KEY", "app-test-key")
    vi.stubEnv("DIFY_MOCK", "0")
    vi.stubEnv("DIFY_BASE_URL", "https://api.dify.ai")
    vi.stubEnv("DIFY_FILE_INPUT_KEY", "document_image")
    vi.stubEnv("VERCEL_ENV", "preview")

    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          code: "invalid_param",
          message: "document_text is required in input form",
          status: 400,
        },
        400
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const { runDifyCheck } = await import("@/lib/dify/client")
    const result = await runDifyCheck({
      municipality: "渋谷区",
      prefecture: "東京都",
      national: "0",
      docType: "提供記録",
      documentText: "テスト用の提供記録です。",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.attempts).toBe(1)
    expect(result.usedFallback).toBe(true)
    expect(result.errorInfo?.retryable).toBe(false)
  })
})
