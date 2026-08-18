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
  logDifyRulesPayloadCheck(options.inputs)
}

type ApprovedRuleLogItem = {
  code: unknown
  title: unknown
  versionNo: unknown
  versionId: unknown
  severity: unknown
  auditItem: unknown
  guidanceLength: number
  guidanceTruncated: boolean
}

/** 個人情報・guidance 全文は出さない */
export function summarizeApprovedRulesForLog(inputs: DifyWorkflowInputs): {
  inputKeys: string[]
  checkAsOf: string
  approvedRuleCount: number
  approvedRules: ApprovedRuleLogItem[]
  regulatoryBasisCount: number
  approvedRulesJsonLength: number
} {
  const json =
    typeof inputs.approved_rules_json === "string"
      ? inputs.approved_rules_json
      : "[]"
  let parsed: unknown = []
  try {
    parsed = JSON.parse(json)
  } catch {
    parsed = []
  }
  const rows = Array.isArray(parsed) ? parsed : []
  const approvedRules: ApprovedRuleLogItem[] = rows.map((row) => {
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {}
    const guidance = typeof r.guidance === "string" ? r.guidance : ""
    return {
      code: r.code,
      title: r.title,
      versionNo: r.version_no,
      versionId: r.version_id,
      severity: r.severity,
      auditItem: r.audit_item,
      guidanceLength: guidance.length,
      guidanceTruncated: r.guidance_truncated === true,
    }
  })
  let basisCount = 0
  if (typeof inputs.regulatory_basis_json === "string") {
    try {
      const basis = JSON.parse(inputs.regulatory_basis_json) as unknown
      basisCount = Array.isArray(basis) ? basis.length : 0
    } catch {
      basisCount = 0
    }
  }
  return {
    inputKeys: Object.keys(inputs),
    checkAsOf:
      typeof inputs.check_as_of === "string" ? inputs.check_as_of : "",
    approvedRuleCount: approvedRules.length,
    approvedRules,
    regulatoryBasisCount: basisCount,
    approvedRulesJsonLength: json.length,
  }
}

export function logDifyRulesPayloadCheck(inputs: DifyWorkflowInputs): void {
  console.error("[dify] rules payload check", summarizeApprovedRulesForLog(inputs))
}
