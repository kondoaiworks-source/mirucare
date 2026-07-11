/**
 * アップロードファイルからテキスト抽出。
 * PDF: pdf-parse（文字が少ないスキャンPDFは1ページ目を画像化してビジョンへ）
 * CSV・テキスト: UTF-8 / 画像: テキストなし（ビジョンへ委譲）
 */

export type ExtractResult = {
  kind: "text" | "image" | "empty"
  text?: string
  imageBase64?: string
  imageMimeType?: string
}

/** これ未満は「実質テキストなし」（ページ番号のみ等）とみなす */
const MIN_USEFUL_TEXT_CHARS = 30

/** スキャンPDFは先頭ページのみ画像化（ペイロード肥大を防ぐ） */
const SCAN_PDF_MAX_PAGES = 1
const SCAN_PDF_TARGET_WIDTH = 900

function isImageMime(mime: string | null | undefined, fileName: string): boolean {
  const m = (mime ?? "").toLowerCase()
  const n = fileName.toLowerCase()
  // `.webp.pdf` は PDF として扱う（拡張子は末尾優先）
  if (n.endsWith(".pdf")) return false
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

/** ページ番号表記などを除いた実質文字数で判定 */
export function isMostlyNoisePdfText(text: string): boolean {
  const stripped = text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
    .replace(/ページ\s*\d+\s*[/／]\s*\d+/gi, "")
    .replace(/\s+/g, "")
    .trim()
  return stripped.length < MIN_USEFUL_TEXT_CHARS
}

async function extractScanPdfAsImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parser: { getScreenshot: (opts: Record<string, unknown>) => Promise<any>; destroy: () => Promise<void> },
  existingText: string
): Promise<ExtractResult> {
  try {
    const shot = await parser.getScreenshot({
      first: SCAN_PDF_MAX_PAGES,
      desiredWidth: SCAN_PDF_TARGET_WIDTH,
      imageBuffer: true,
      imageDataUrl: false,
    })
    const page = shot?.pages?.[0]
    const data = page?.data as Uint8Array | Buffer | undefined
    if (!data || (data as Uint8Array).length === 0) {
      return {
        kind: "empty",
        text: existingText || "",
      }
    }
    const imageBase64 = Buffer.from(data).toString("base64")
    console.error("[check] pdf_scan_as_image", {
      page: page.pageNumber ?? 1,
      width: page.width,
      height: page.height,
      imageBytes: (data as Uint8Array).length,
      textLength: existingText.length,
    })
    return {
      kind: "image",
      text:
        "（スキャンPDFのため1ページ目を画像として送信しています。画像を読み取って点検してください）",
      imageBase64,
      imageMimeType: "image/png",
    }
  } catch (err) {
    console.error("[check] pdf_screenshot_failed", {
      errorKind: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    })
    return {
      kind: "empty",
      text: existingText || "",
    }
  }
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
      try {
        const data = await parser.getText()
        const text = (data.text ?? "").trim()
        if (!isMostlyNoisePdfText(text)) {
          return { kind: "text", text }
        }
        // 文字がほぼ無い → スキャンPDFとして画像化
        return await extractScanPdfAsImage(parser, text)
      } finally {
        await parser.destroy().catch(() => undefined)
      }
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
