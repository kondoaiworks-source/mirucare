import { getDifyApiKey, getDifyBaseUrl, normalizeEnvValue } from "./env"

export const DIFY_CHECK_USER = "kansatsu-check"

type DifyUploadResponse = {
  id?: string
  name?: string
  size?: number
  mime_type?: string
  extension?: string
}

export type DifyFileMapping = {
  type: "image" | "document" | "custom"
  transfer_method: "local_file"
  upload_file_id: string
}

/** Vision / File Array 変数名。開始ノードの document_image に合わせる */
export function getDifyFileInputKey(): string {
  const raw = normalizeEnvValue(process.env.DIFY_FILE_INPUT_KEY)
  return raw || "document_image"
}

export function mimeToDifyFileType(
  mime: string | undefined
): DifyFileMapping["type"] {
  const m = (mime ?? "").toLowerCase()
  if (m.startsWith("image/")) return "image"
  if (m === "application/pdf") return "document"
  return "custom"
}

function extensionForMime(mime: string | undefined): string {
  const m = (mime ?? "").toLowerCase()
  if (m === "image/png") return "png"
  if (m === "image/jpeg" || m === "image/jpg") return "jpg"
  if (m === "image/webp") return "webp"
  if (m === "image/gif") return "gif"
  if (m === "application/pdf") return "pdf"
  return "bin"
}

/**
 * Dify File Upload API。
 * POST /v1/files/upload（multipart）。user は workflows/run と同じにする。
 */
export async function uploadDifyFile(options: {
  bytes: Buffer
  mimeType: string
  fileName?: string
  user?: string
}): Promise<{ id: string; mimeType: string }> {
  const apiKey = getDifyApiKey()
  if (!apiKey) {
    throw new Error("DIFY_API_KEY が未設定です")
  }
  const baseUrl = getDifyBaseUrl()
  const user = options.user ?? DIFY_CHECK_USER
  const mimeType = options.mimeType || "application/octet-stream"
  const fileName =
    options.fileName?.trim() ||
    `document.${extensionForMime(mimeType)}`

  const form = new FormData()
  const file = new File([new Uint8Array(options.bytes)], fileName, {
    type: mimeType,
  })
  form.append("file", file)
  form.append("user", user)

  const res = await fetch(`${baseUrl}/v1/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  })

  const text = await res.text()
  if (!res.ok) {
    console.error("[dify] file_upload_failed", {
      httpStatus: res.status,
      bodyLength: text.length,
    })
    throw new Error(`Dify ファイルアップロードに失敗しました (${res.status})`)
  }

  let payload: DifyUploadResponse
  try {
    payload = JSON.parse(text) as DifyUploadResponse
  } catch {
    throw new Error("Dify ファイルアップロード応答が不正です")
  }

  const id = payload.id?.trim()
  if (!id) {
    throw new Error("Dify ファイル ID を取得できませんでした")
  }

  console.error("[dify] file_uploaded", {
    idPrefix: id.slice(0, 8),
    size: payload.size ?? options.bytes.length,
    mime: payload.mime_type ?? mimeType,
  })

  return { id, mimeType: payload.mime_type ?? mimeType }
}

export async function uploadBase64AsDifyFile(options: {
  imageBase64: string
  mimeType?: string
  fileName?: string
}): Promise<DifyFileMapping> {
  const raw = options.imageBase64.includes(",")
    ? options.imageBase64.split(",").pop() ?? options.imageBase64
    : options.imageBase64
  const bytes = Buffer.from(raw, "base64")
  if (bytes.length === 0) {
    throw new Error("画像データが空です")
  }
  const mimeType = options.mimeType ?? "image/png"
  const uploaded = await uploadDifyFile({
    bytes,
    mimeType,
    fileName: options.fileName,
  })
  return {
    type: mimeToDifyFileType(uploaded.mimeType),
    transfer_method: "local_file",
    upload_file_id: uploaded.id,
  }
}
