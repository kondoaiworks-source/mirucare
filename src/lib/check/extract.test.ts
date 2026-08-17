import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  extractPdfPlainText,
  extractDocumentContent,
  isFailedExtractPlaceholder,
  isMostlyNoisePdfText,
  joinPdfTextChunks,
  pdfPageRanges,
  PDF_TEXT_PAGE_CHUNK,
  shouldSkipDifyForExtract,
} from "@/lib/check/extract"
import { findPlanDateAlignmentFinding } from "@/lib/check/plan-date-alignment"
import {
  SAMPLE_CHECK_PDF_MUST_CONTAIN,
  SAMPLE_CHECK_PDF_RELATIVE_PATH,
} from "@/lib/check/sample-check-pdf"

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

  it("埋め込み日本語のサンプルPDFから本文と日付整合を拾う", async () => {
    const pdf = readFileSync(join(process.cwd(), SAMPLE_CHECK_PDF_RELATIVE_PATH))
    const text = await extractPdfPlainText(pdf)
    for (const phrase of SAMPLE_CHECK_PDF_MUST_CONTAIN) {
      expect(text).toContain(phrase)
    }
    expect(isMostlyNoisePdfText(text)).toBe(false)
    expect(shouldSkipDifyForExtract({ kind: "text", text })).toBe(false)
    expect(findPlanDateAlignmentFinding(text)?.title).toContain(
      "ケアプラン更新に追いついていない可能性"
    )
  })
})

describe("isMostlyNoisePdfText", () => {
  it("ページ番号だけならノイズ", () => {
    expect(isMostlyNoisePdfText("-- 1 of 1 --")).toBe(true)
    expect(
      isMostlyNoisePdfText(
        "訪問介護計画の作成日がケアプランの更新日より前になっていないかご確認ください"
      )
    ).toBe(false)
  })
})

describe("shouldSkipDifyForExtract", () => {
  it("失敗定型文は Dify に渡さない", () => {
    const placeholder =
      "（PDFのテキスト抽出に失敗しました。文字の入ったPDFか、画像が鮮明かご確認ください）"
    expect(isFailedExtractPlaceholder(placeholder)).toBe(true)
    expect(
      shouldSkipDifyForExtract({ kind: "text", text: placeholder })
    ).toBe(true)
  })

  it("empty は Dify に渡さない", () => {
    expect(shouldSkipDifyForExtract({ kind: "empty", text: "" })).toBe(true)
  })

  it("本文があるときは渡す", () => {
    expect(
      shouldSkipDifyForExtract({
        kind: "text",
        text: "訪問介護計画の作成日がケアプランの更新日より前になっていないかご確認ください",
      })
    ).toBe(false)
  })

  it("画像があるときは渡す", () => {
    expect(
      shouldSkipDifyForExtract({
        kind: "image",
        imageBase64: "abc",
        text: "",
      })
    ).toBe(false)
  })
})

describe("extractDocumentContent の経路", () => {
  it("CSVはテキスト抽出し、画像は付けない", async () => {
    const csv = readFileSync(
      join(process.cwd(), "public/samples/attendance-service-records.csv")
    )
    const extracted = await extractDocumentContent(
      csv,
      "text/csv",
      "service-records.csv"
    )
    expect(extracted.kind).toBe("text")
    expect(extracted.imageBase64).toBeUndefined()
    expect(extracted.text).toContain("ヘルパー名")
    expect(extracted.text).toContain("山田花子")
    expect(shouldSkipDifyForExtract(extracted)).toBe(false)
  })

  it("画像は Dify ファイル渡し用に base64 だけ返す", async () => {
    const extracted = await extractDocumentContent(
      Buffer.from("fake-image-bytes"),
      "image/jpeg",
      "record.jpg"
    )
    expect(extracted.kind).toBe("image")
    expect(extracted.imageBase64).toBeTruthy()
    expect(extracted.text).toBeUndefined()
    expect(shouldSkipDifyForExtract(extracted)).toBe(false)
  })
})

describe("resolvePublicPdfjsCmapUrl", () => {
  it("VERCEL_URL があるとき末尾スラッシュの https URL", async () => {
    const prev = process.env.VERCEL_URL
    process.env.VERCEL_URL = "mirucare.vercel.app"
    const { resolvePublicPdfjsCmapUrl } = await import(
      "@/lib/check/pdfjs-node-assets"
    )
    expect(resolvePublicPdfjsCmapUrl()).toBe(
      "https://mirucare.vercel.app/pdfjs/cmaps/"
    )
    if (prev === undefined) delete process.env.VERCEL_URL
    else process.env.VERCEL_URL = prev
  })
})
