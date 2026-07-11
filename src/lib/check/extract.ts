/**
 * アップロードファイルからテキスト抽出。
 * PDF: pdf-parse / CSV・テキスト: UTF-8 / 画像: テキストなし（ビジョンへ委譲）
 */

export type ExtractResult = {
  kind: "text" | "image" | "empty"
  text?: string
  imageBase64?: string
  imageMimeType?: string
}

function isImageMime(mime: string | null | undefined, fileName: string): boolean {
  const m = (mime ?? "").toLowerCase()
  const n = fileName.toLowerCase()
  return (
    m.startsWith("image/") ||
    n.endsWith(".jpg") ||
    n.endsWith(".jpeg") ||
    n.endsWith(".png") ||
    n.endsWith(".webp") ||
    n.endsWith(".heic") ||
    n.endsWith(".heif")
  )
}

function isPdf(mime: string | null | undefined, fileName: string): boolean {
  return (
    (mime ?? "").toLowerCase() === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf")
  )
}

function isTextLike(mime: string | null | undefined, fileName: string): boolean {
  const m = (mime ?? "").toLowerCase()
  const n = fileName.toLowerCase()
  return (
    m === "text/csv" ||
    m === "text/plain" ||
    n.endsWith(".csv") ||
    n.endsWith(".txt")
  )
}

export async function extractDocumentContent(
  buffer: Buffer,
  mimeType: string | null,
  fileName: string
): Promise<ExtractResult> {
  if (isImageMime(mimeType, fileName)) {
    const mime =
      mimeType && mimeType.startsWith("image/")
        ? mimeType
        : "image/jpeg"
    return {
      kind: "image",
      imageBase64: buffer.toString("base64"),
      imageMimeType: mime,
    }
  }

  if (isPdf(mimeType, fileName)) {
    try {
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: buffer })
      const data = await parser.getText()
      await parser.destroy()
      const text = (data.text ?? "").trim()
      if (!text) {
        return { kind: "empty", text: "" }
      }
      return { kind: "text", text }
    } catch {
      return {
        kind: "text",
        text: "（PDFのテキスト抽出に失敗しました。画像スキャンの可能性があります）",
      }
    }
  }

  if (isTextLike(mimeType, fileName)) {
    const text = buffer.toString("utf-8")
    return { kind: "text", text }
  }

  // Excel 等は当面ファイル名のみヒント
  return {
    kind: "text",
    text: `（バイナリ形式のため本文抽出をスキップしました。ファイル名: ${fileName.replace(/[^\w.\-一-龥ぁ-んァ-ン]/g, "_")}）`,
  }
}
