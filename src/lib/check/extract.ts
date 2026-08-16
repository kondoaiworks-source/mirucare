/**
 * アップロードファイルからテキスト抽出。
 * PDF本文: unpdf（Vercel向け。ワーカーに Factory を渡さない）
 * 日本語 CMap: 本番は HTTP（/pdfjs/cmaps）
 * CSV・テキスト: UTF-8 / 画像: テキストなし（ビジョンへ委譲）
 */

import { extractText, getDocumentProxy } from "unpdf"
import { unpdfDocumentOptions } from "@/lib/check/pdfjs-node-assets"

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

/** 以前 pdf-parse 失敗時に Dify へ渡していた定型（44文字） */
export const PDF_EXTRACT_FAILED_HINT = "PDFのテキスト抽出に失敗しました"

function isImageMime(mime: string | null | undefined, fileName: string): boolean {
  const m = (mime ?? "").toLowerCase()
  const n = fileName.toLowerCase()
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

export function isFailedExtractPlaceholder(text: string): boolean {
  const t = text.trim()
  return t.includes(PDF_EXTRACT_FAILED_HINT) && t.length < 80
}

/** 画像が無く本文も使えないときは Dify に渡さない */
export function shouldSkipDifyForExtract(input: {
  kind?: ExtractResult["kind"]
  text?: string
  imageBase64?: string
}): boolean {
  if (input.imageBase64) return false
  if (input.kind === "image") return false
  if (input.kind === "empty") return true
  const text = input.text ?? ""
  if (isFailedExtractPlaceholder(text)) return true
  return isMostlyNoisePdfText(text)
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
 * PDF本文テキストのみ抽出（スキャン画像化なし）。
 * ナレッジ差分用スナップショットでも使用。
 * 本番で途中例外になっても、空文字を返して呼び出し側で案内する。
 */
export async function extractPdfPlainText(buffer: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(
      Uint8Array.from(buffer),
      unpdfDocumentOptions()
    )
    try {
      if (buffer.byteLength <= PDF_FULL_EXTRACT_MAX_BYTES) {
        try {
          const { text } = await extractText(pdf, { mergePages: true })
          const merged = text.trim()
          if (!isMostlyNoisePdfText(merged)) {
            return capExtractedText(merged)
          }
        } catch (err) {
          console.error("[extract] pdf_full_failed", {
            error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
            bytes: buffer.byteLength,
          })
        }
      }

      const { totalPages, text: pages } = await extractText(pdf, {
        mergePages: false,
      })
      const parts: string[] = []
      let textBytes = 0
      for (const page of pages) {
        const chunk = page.trim()
        if (chunk) {
          parts.push(chunk)
          textBytes += Buffer.byteLength(chunk, "utf8")
        }
        if (textBytes >= PDF_EXTRACT_TEXT_SOFT_LIMIT_BYTES) {
          break
        }
      }
      const text = joinPdfTextChunks(parts)
      if (totalPages >= 40) {
        console.error("[extract] pdf_plain_text", {
          totalPages,
          pagesUsed: parts.length,
          textBytes: Buffer.byteLength(text, "utf8"),
        })
      }
      return text
    } finally {
      await pdf.loadingTask.destroy().catch(() => undefined)
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
    const text = await extractPdfPlainText(buffer)
    if (!isMostlyNoisePdfText(text) && !isFailedExtractPlaceholder(text)) {
      return { kind: "text", text }
    }
    console.error("[extract] pdf_text_empty", { bytes: buffer.byteLength })
    return { kind: "empty", text: "" }
  }

  if (isTextLike(mimeType, fileName)) {
    const text = buffer.toString("utf-8")
    return { kind: "text", text }
  }

  return {
    kind: "text",
    text: `（バイナリ形式のため本文抽出をスキップしました。ファイル名: ${fileName.replace(/[^\w.\-一-龥ぁ-んァ-ン]/g, "_")}）`,
  }
}
