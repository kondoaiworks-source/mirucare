import { describe, expect, it } from "vitest"
import {
  isEmptyMessagesHint,
  isFatalDifyConfigHint,
  isFileParamHint,
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
