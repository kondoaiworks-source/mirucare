import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { extractDocumentContent } from "@/lib/check/extract"
import {
  buildDifyWorkflowInputs,
  filterValidDifyFiles,
  isValidDifyFileMapping,
  summarizeDifyRequestPayload,
} from "@/lib/dify/workflow-payload"

const FILE_KEY = "document_image"

function textOnlyInputs(text: string) {
  return buildDifyWorkflowInputs({
    documentText: text,
    prefecture: "東京都",
    municipality: "渋谷区",
    docType: "提供記録",
    national: "0",
    fileInputKey: FILE_KEY,
    files: [],
  })
}

describe("isValidDifyFileMapping", () => {
  it("upload_file_id がある local_file だけ有効", () => {
    expect(
      isValidDifyFileMapping({
        type: "image",
        transfer_method: "local_file",
        upload_file_id: "file-1",
      })
    ).toBe(true)
    expect(
      isValidDifyFileMapping({
        type: "image",
        transfer_method: "local_file",
        upload_file_id: "",
      })
    ).toBe(false)
    expect(isValidDifyFileMapping(null)).toBe(false)
    expect(isValidDifyFileMapping({})).toBe(false)
  })
})

describe("filterValidDifyFiles", () => {
  it("空・不正は空配列", () => {
    expect(filterValidDifyFiles(undefined)).toEqual([])
    expect(filterValidDifyFiles(null)).toEqual([])
    expect(filterValidDifyFiles([])).toEqual([])
    expect(filterValidDifyFiles([null, { type: "image" }])).toEqual([])
  })
})

describe("buildDifyWorkflowInputs", () => {
  it("CSV/文字PDF向け: ファイル無しなら document_image キー自体を付けない", () => {
    const inputs = textOnlyInputs("サービス提供記録の本文です。同意欄をご確認ください。")
    expect("document_image" in inputs).toBe(false)
    expect(inputs.document_image).toBeUndefined()
    expect(JSON.parse(JSON.stringify(inputs))).not.toHaveProperty(
      "document_image"
    )

    const summary = summarizeDifyRequestPayload({
      inputs,
      fileInputKey: FILE_KEY,
    })
    expect(summary.hasDocumentText).toBe(true)
    expect(summary.textLength).toBeGreaterThan(0)
    expect(summary.hasDocumentImage).toBe(false)
    expect(summary.documentImageCount).toBe(0)
    expect(summary.inputKeys).toEqual([
      "document_text",
      "prefecture",
      "municipality",
      "doc_type",
      "document_type",
      "national",
      "approved_rules_json",
      "regulatory_basis_json",
      "check_as_of",
    ])
    expect(summary.inputKeys).toContain("document_text")
    expect(summary.inputKeys).toContain("document_type")
    expect(summary.inputKeys).toContain("national")
    expect(summary.inputKeys).not.toContain("document_image")
  })

  it("空配列・null・空文字を files にしても document_image を付けない", () => {
    for (const files of [[], null, "", undefined, [{}], [{ upload_file_id: "" }]]) {
      const inputs = buildDifyWorkflowInputs({
        documentText: "本文あり",
        docType: "提供記録",
        national: "0",
        fileInputKey: FILE_KEY,
        files,
      })
      expect("document_image" in inputs).toBe(false)
    }
  })

  it("有効なファイルがあるときだけ document_image を配列で付ける", () => {
    const valid = {
      type: "image" as const,
      transfer_method: "local_file" as const,
      upload_file_id: "upload-abc",
    }
    const inputs = buildDifyWorkflowInputs({
      documentText: "画像点検用の案内文",
      docType: "提供記録",
      national: "0",
      fileInputKey: FILE_KEY,
      files: [valid, { type: "image", transfer_method: "local_file", upload_file_id: "" }],
    })
    expect(inputs.document_image).toEqual([valid])
    expect(summarizeDifyRequestPayload({ inputs, fileInputKey: FILE_KEY })).toMatchObject({
      hasDocumentImage: true,
      documentImageCount: 1,
    })
  })
})

describe("抽出結果から Dify inputs を組む", () => {
  it("サービス提供記録CSVは document_text のみ（document_image なし）", async () => {
    const csv = readFileSync(
      join(process.cwd(), "public/samples/attendance-service-records.csv")
    )
    const extracted = await extractDocumentContent(csv, "text/csv", "service.csv")
    expect(extracted.kind).toBe("text")
    expect(extracted.imageBase64).toBeUndefined()
    expect((extracted.text ?? "").length).toBeGreaterThan(0)
    expect(extracted.text).toContain("ヘルパー名")

    const inputs = buildDifyWorkflowInputs({
      documentText: extracted.text ?? "",
      docType: "提供記録",
      national: "0",
      fileInputKey: FILE_KEY,
      files: extracted.imageBase64 ? [{ type: "image" }] : [],
    })
    expect("document_image" in inputs).toBe(false)
    expect(String(inputs.document_text).length).toBeGreaterThan(0)
  })

  it("文字入りPDFは document_text のみ（document_image なし）", async () => {
    const pdf = readFileSync(
      join(process.cwd(), "public/samples/check-text-readable.pdf")
    )
    const extracted = await extractDocumentContent(
      pdf,
      "application/pdf",
      "check-text-readable.pdf"
    )
    expect(extracted.kind).toBe("text")
    expect(extracted.imageBase64).toBeUndefined()
    expect((extracted.text ?? "").length).toBeGreaterThan(30)

    const inputs = buildDifyWorkflowInputs({
      documentText: extracted.text ?? "",
      docType: "ケアプラン",
      national: "0",
      fileInputKey: FILE_KEY,
    })
    expect("document_image" in inputs).toBe(false)
    expect(summarizeDifyRequestPayload({ inputs, fileInputKey: FILE_KEY }).hasDocumentImage).toBe(
      false
    )
  })
})
