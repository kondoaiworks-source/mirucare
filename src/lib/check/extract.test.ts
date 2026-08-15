import { describe, expect, it } from "vitest"
import {
  extractPdfPlainText,
  joinPdfTextChunks,
  pdfPageRanges,
  PDF_TEXT_PAGE_CHUNK,
} from "@/lib/check/extract"

function buildTextPdf(pages: string[]): Buffer {
  const fontId = 3 + pages.length * 2
  const kids = pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ")
  const objects: string[] = []
  objects[1] = `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n`
  objects[2] =
    `2 0 obj << /Type /Pages /Count ${pages.length} /Kids [${kids}] >> endobj\n`
  objects[fontId] =
    `${fontId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`

  pages.forEach((text, i) => {
    const pageId = 3 + i * 2
    const contentId = pageId + 1
    const escaped = text
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
    const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`
    objects[pageId] =
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >> endobj\n`
    objects[contentId] =
      `${contentId} 0 obj << /Length ${Buffer.byteLength(stream, "latin1")} >> stream\n${stream}\nendstream endobj\n`
  })

  let body = "%PDF-1.4\n"
  const offsets: number[] = [0]
  for (let i = 1; i <= fontId; i++) {
    offsets[i] = Buffer.byteLength(body, "latin1")
    body += objects[i]
  }
  const xrefPos = Buffer.byteLength(body, "latin1")
  let xref = `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= fontId; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
  }
  body += xref
  body += `trailer << /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  return Buffer.from(body, "latin1")
}

describe("pdfPageRanges", () => {
  it("1ページは1範囲", () => {
    expect(pdfPageRanges(1, 8)).toEqual([[1, 1]])
  })

  it("113ページを8件ずつに分ける", () => {
    const ranges = pdfPageRanges(113, PDF_TEXT_PAGE_CHUNK)
    expect(ranges[0]).toEqual([1, 8])
    expect(ranges.at(-1)).toEqual([113, 113])
    expect(ranges).toHaveLength(15)
  })
})

describe("joinPdfTextChunks", () => {
  it("空と前後空白を除いてつなぐ", () => {
    expect(joinPdfTextChunks(["  a  ", "", "b", "  "])).toBe("a\nb")
  })
})

describe("extractPdfPlainText", () => {
  it("複数ページの文字をまとめて返す", async () => {
    const pages = Array.from({ length: 12 }, (_, i) => `Visit care page ${i + 1}`)
    const text = await extractPdfPlainText(buildTextPdf(pages))
    expect(text).toContain("Visit care page 1")
    expect(text).toContain("Visit care page 12")
  })
})
