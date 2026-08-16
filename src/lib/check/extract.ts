/**
 * アップロードファイルからテキスト抽出。
 * PDF本文: pdf-parse.getText（日本語 CMap をファイルパスで読む）
 * 文字がほぼ無いときだけ: 1ページ目を画像化してビジョンへ
 * CSV・テキスト: UTF-8 / 画像: テキストなし（ビジョンへ委譲）
 */

import {
  loadPdfParse,
  pdfParseLoadOptions,
} from "@/lib/check/pdfjs-node-assets"

export type ExtractResult = {
  kind: "text" | "image" | "empty"
  text?: string
  imageBase64?: string
  imageMimeType?: string
}

/** これ未満は「実質テキストなし」（ページ番号のみ等）とみなす */
const MIN_USEFUL_TEXT_CHARS = 30

/** 100ページ超の公式PDFでもメモリを抑えつつ抜く */
export const PDF_TEXT_PAGE_CHUNK = 8
/** 抽出テキストのソフト上限（UTF-8 バイト）。スナップショット保存上限と揃える */
export const PDF_EXTRACT_TEXT_SOFT_LIMIT_BYTES = 2 * 1024 * 1024

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
        "（本文の文字が十分に取れなかったため、1ページ目を画像として送信しています。画像を読み取って点検してください）",
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

/** 1..total を chunkSize 件ずつのページ範囲に分ける */
export function pdfPageRanges(
  totalPages: number,
  chunkSize: number = PDF_TEXT_PAGE_CHUNK
): Array<[number, number]> {
  const total = Math.max(1, Math.floor(Number(totalPages)) || 1)
  const size = Math.max(1, Math.floor(Number(chunkSize)) || 1)
  const ranges: Array<[number, number]> = []
  for (let start = 1; start <= total; start += size) {
    ranges.push([start, Math.min(start + size - 1, total)])
  }
  return ranges
}

export function joinPdfTextChunks(chunks: string[]): string {
  return chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .join("\n")
    .trim()
}

function capExtractedText(text: string): string {
  const buf = Buffer.from(text, "utf8")
  if (buf.byteLength <= PDF_EXTRACT_TEXT_SOFT_LIMIT_BYTES) return text
  return buf.subarray(0, PDF_EXTRACT_TEXT_SOFT_LIMIT_BYTES).toString("utf8")
}

/**
 * pdf-parse で本文を抜く。unpdf と同時に使うと pdf.js の worker 版が食い違う。
 */
async function extractPdfTextWithPdfParse(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = loadPdfParse()
    const parser = new PDFParse(pdfParseLoadOptions(buffer))
    try {
      const result = await parser.getText({ pageJoiner: "\n" })
      return capExtractedText((result.text ?? "").trim())
    } finally {
      await parser.destroy().catch(() => undefined)
    }
  } catch (err) {
    console.error("[extract] pdf_parse_text_failed", {
      error: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? err.message.slice(0, 160) : "unknown",
    })
    return ""
  }
}

/**
 * PDF本文テキストのみ抽出（スキャン画像化なし）。
 * ナレッジ差分用スナップショットでも使用。
 * 本番で途中例外になっても、空文字を返して呼び出し側で案内する。
 */
export async function extractPdfPlainText(buffer: Buffer): Promise<string> {
  const text = await extractPdfTextWithPdfParse(buffer)
  if (isMostlyNoisePdfText(text)) {
    console.error("[extract] pdf_text_empty", { bytes: buffer.byteLength })
  }
  return text
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
      const text = await extractPdfPlainText(buffer)
      if (!isMostlyNoisePdfText(text)) {
        return { kind: "text", text }
      }
      const { PDFParse } = loadPdfParse()
      const parser = new PDFParse(pdfParseLoadOptions(buffer))
      try {
        // 本文が空 → 画像PDFの可能性。1ページ目を送る
        return await extractScanPdfAsImage(parser, text)
      } finally {
        await parser.destroy().catch(() => undefined)
      }
    } catch {
      return {
        kind: "text",
        text: "（PDFのテキスト抽出に失敗しました。文字の入ったPDFか、画像が鮮明かご確認ください）",
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
