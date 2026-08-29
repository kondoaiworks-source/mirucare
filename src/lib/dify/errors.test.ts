import { describe, expect, it } from "vitest"
import {
  buildStructuredDifyError,
  isEmptyMessagesHint,
  isFatalDifyConfigHint,
  isFileParamHint,
  isTransientDifyError,
  sanitizeErrorHint,
} from "@/lib/dify/errors"

describe("sanitizeErrorHint", () => {
  it("invalid_param だけでは invalid_file_param にしない", () => {
    expect(
      sanitizeErrorHint(
        JSON.stringify({
          code: "invalid_param",
          message: "Model is not configured",
          status: 400,
        })
      )
    ).toBe("model_not_configured")
    expect(
      isFileParamHint(
        sanitizeErrorHint(
          JSON.stringify({
            code: "invalid_param",
            message: "Model is not configured",
          })
        )
      )
    ).toBe(false)
  })

  it("ファイル形式の不正だけ invalid_file_param", () => {
    expect(
      sanitizeErrorHint(
        JSON.stringify({
          code: "invalid_param",
          message: "document_image in input form must be a list of files",
        })
      )
    ).toBe("invalid_file_param")
    expect(
      sanitizeErrorHint(
        JSON.stringify({
          code: "invalid_param",
          message: "orig_mail in input form must be a file",
        })
      )
    ).toBe("invalid_file_param")
  })

  it("空 messages は llm_empty_messages", () => {
    expect(
      sanitizeErrorHint("messages: at least one message is required")
    ).toBe("llm_empty_messages")
    expect(isEmptyMessagesHint("llm_empty_messages")).toBe(true)
    expect(isEmptyMessagesHint("invalid_file_param")).toBe(false)
  })

  it("モデル未設定は設定エラーとして再試行しない", () => {
    expect(isFatalDifyConfigHint("model_not_configured")).toBe(true)
  })
})

describe("isTransientDifyError", () => {
  it("503 UNAVAILABLE / ServerError は再試行対象", () => {
    const raw =
      'req_id: f298ca246d PluginInvokeError: {"args":{"description":"google.genai.errors.ServerError: 503 UNAVAILABLE This model is currently experiencing high demand."}}'
    expect(isTransientDifyError({ raw })).toBe(true)
    const info = buildStructuredDifyError({
      raw,
      errorKind: "workflow_failed",
    })
    expect(info).toMatchObject({
      errorKind: "workflow_failed",
      errorType: "ServerError",
      statusCode: 503,
      reqId: "f298ca246d",
      retryable: true,
    })
  })

  it("400 / invalid_param は再試行しない", () => {
    expect(
      isTransientDifyError({
        raw: JSON.stringify({ code: "invalid_param", message: "doc_type is required" }),
        httpStatus: 400,
        hint: "invalid_param:doc_type is required",
      })
    ).toBe(false)
    expect(
      isTransientDifyError({
        raw: "Bad Request",
        httpStatus: 400,
        hint: "bad_request",
      })
    ).toBe(false)
  })

  it("429 rate limit は再試行対象", () => {
    expect(
      isTransientDifyError({
        raw: "rate limit exceeded",
        httpStatus: 429,
      })
    ).toBe(true)
  })

  it("model_not_configured は再試行しない", () => {
    expect(
      isTransientDifyError({
        raw: JSON.stringify({
          code: "invalid_param",
          message: "Model is not configured",
        }),
        hint: "model_not_configured",
      })
    ).toBe(false)
    const info = buildStructuredDifyError({
      raw: JSON.stringify({
        code: "invalid_param",
        message: "Model is not configured",
      }),
      hint: "model_not_configured",
      errorKind: "workflow_failed",
    })
    expect(info.retryable).toBe(false)
  })
})
