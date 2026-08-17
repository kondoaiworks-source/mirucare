import type { DifyFileMapping } from "./files"

export type DifyWorkflowInputs = Record<
  string,
  string | DifyFileMapping | DifyFileMapping[]
>

export function isValidDifyFileMapping(
  value: unknown
): value is DifyFileMapping {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<DifyFileMapping>
  const typeOk =
    item.type === "image" || item.type === "document" || item.type === "custom"
  const methodOk = item.transfer_method === "local_file"
  const idOk =
    typeof item.upload_file_id === "string" && item.upload_file_id.trim().length > 0
  return typeOk && methodOk && idOk
}

/** 空配列・null・欠けたオブジェクトは送らない */
export function filterValidDifyFiles(
  files: unknown
): DifyFileMapping[] {
  if (!Array.isArray(files) || files.length === 0) return []
  return files.filter(isValidDifyFileMapping)
}

/**
 * Workflow /v1/workflows/run の inputs を組み立てる。
 * 有効なファイルがあるときだけ fileInputKey（既定 document_image）を載せる。
 * [] / null / "" / undefined はキーごと付けない。
 */
export function buildDifyWorkflowInputs(options: {
  documentText: string
  prefecture?: string
  municipality?: string
  docType?: string
  national?: string
  approvedRulesJson?: string
  regulatoryBasisJson?: string
  checkAsOf?: string
  fileInputKey: string
  files?: unknown
}): DifyWorkflowInputs {
  const docType = options.docType || "その他"
  const inputs: DifyWorkflowInputs = {
    document_text: options.documentText,
    prefecture: options.prefecture || "",
    municipality: options.municipality || "",
    doc_type: docType,
    document_type: docType,
    national: options.national || "1",
    approved_rules_json: options.approvedRulesJson || "[]",
    regulatory_basis_json: options.regulatoryBasisJson || "[]",
    check_as_of: options.checkAsOf || "",
  }

  const validFiles = filterValidDifyFiles(options.files)
  if (validFiles.length > 0) {
    inputs[options.fileInputKey] = validFiles
  }

  return inputs
}

export function summarizeDifyRequestPayload(options: {
  inputs: DifyWorkflowInputs
  fileInputKey: string
}): {
  inputKeys: string[]
  hasDocumentText: boolean
  textLength: number
  hasDocumentImage: boolean
  documentImageCount: number
} {
  const { inputs, fileInputKey } = options
  const text = inputs.document_text
  const image = inputs[fileInputKey]
  return {
    inputKeys: Object.keys(inputs),
    hasDocumentText: Boolean(typeof text === "string" && text.trim()),
    textLength: typeof text === "string" ? text.length : 0,
    hasDocumentImage: "document_image" in inputs || fileInputKey in inputs,
    documentImageCount: Array.isArray(image) ? image.length : 0,
  }
}

export function logDifyRequestPayloadCheck(options: {
  inputs: DifyWorkflowInputs
  fileInputKey: string
}): void {
  console.log(
    "[dify] request payload check",
    summarizeDifyRequestPayload(options)
  )
}
