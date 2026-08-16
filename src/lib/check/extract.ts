/**
 * アップロードファイルからテキスト抽出。
 * PDF: pdf-parse（文字が少ないスキャンPDFは1ページ目を画像化してビジョンへ）
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
/** これ以下は一括抽出を先に試す（介護報酬Q&A Vol.1 は約1.2MB / 113ページ） */
const PDF_FULL_EXTRACT_MAX_BYTES = 8 * 1024 * 1024

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

/**
 * PDF本文テキストのみ抽出（スキャン画像化なし）。
 * ナレッジ差分用スナップショットで使用。
 * 中規模の公式PDFは一括、大きいもの・一括失敗は数ページずつ抜く。
 * 本番で途中例外になっても、空文字を返して呼び出し側で案内する。
 */
export async function extractPdfPlainText(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = loadPdfParse()
    const parser = new PDFParse(pdfParseLoadOptions(buffer))
    try {
      if (buffer.byteLength <= PDF_FULL_EXTRACT_MAX_BYTES) {
        try {
          const data = await parser.getText()
          const text = (data.text ?? "").trim()
          if (!isMostlyNoisePdfText(text)) {
            return text
          }
        } catch (err) {
          console.error("[extract] pdf_full_failed", {
            error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
            bytes: buffer.byteLength,
          })
        }
      }

      let totalPages = 0
      try {
        const info = await parser.getInfo()
        totalPages = Math.max(0, Number(info.total) || 0)
      } catch (err) {
        console.error("[extract] pdf_info_failed", {
          error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
        })
      }

      if (totalPages <= 0) {
        try {
          const data = await parser.getText()
          return (data.text ?? "").trim()
        } catch (err) {
          console.error("[extract] pdf_retry_failed", {
            error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
          })
          return ""
        }
      }

      const parts: string[] = []
      let textBytes = 0
      let chunksOk = 0
      let chunksFailed = 0
      const ranges = pdfPageRanges(totalPages, PDF_TEXT_PAGE_CHUNK)

      for (const [first, last] of ranges) {
        try {
          const data = await parser.getText({ first, last })
          const chunk = (data.text ?? "").trim()
          if (chunk) {
            parts.push(chunk)
            textBytes += Buffer.byteLength(chunk, "utf8")
          }
          chunksOk += 1
        } catch (err) {
          chunksFailed += 1
          console.error("[extract] pdf_chunk_failed", {
            first,
            last,
            totalPages,
            error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
          })
        }
        if (textBytes >= PDF_EXTRACT_TEXT_SOFT_LIMIT_BYTES) {
          break
        }
      }

      const text = joinPdfTextChunks(parts)
      if (chunksFailed > 0 || totalPages >= 40) {
        console.error("[extract] pdf_plain_text", {
          totalPages,
          chunksOk,
          chunksFailed,
          textBytes: Buffer.byteLength(text, "utf8"),
        })
      }
      return text
    } finally {
      await parser.destroy().catch(() => undefined)
    }
  } catch (err) {
    console.error("[extract] pdf_plain_text_failed", {
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      name: err instanceof Error ? err.name : "unknown",
    })
    return ""
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
      const text = await extractPdfPlainText(buffer)
      if (!isMostlyNoisePdfText(text)) {
        return { kind: "text", text }
      }
      const { PDFParse } = loadPdfParse()
      const parser = new PDFParse(pdfParseLoadOptions(buffer))
      try {
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
