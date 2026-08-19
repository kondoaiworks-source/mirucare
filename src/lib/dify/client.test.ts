import { afterEach, describe, expect, it, vi } from "vitest"

const SUCCESS_OUTPUT = JSON.stringify({ findings: [] })

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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
})
