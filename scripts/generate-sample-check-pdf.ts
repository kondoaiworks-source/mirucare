/**
 * 日本語をフォント埋め込みした「文字選択できる」サンプルPDFを生成する。
 * CMap が無くても unpdf が抜ける（ToUnicode 付き）ことを優先する。
 *
 *   npx tsx scripts/generate-sample-check-pdf.ts
 */
import { createWriteStream, existsSync, readFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { fileURLToPath } from "node:url"
import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb } from "pdf-lib"
import {
  SAMPLE_CHECK_PDF_LINES,
  SAMPLE_CHECK_PDF_RELATIVE_PATH,
} from "../src/lib/check/sample-check-pdf"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(ROOT, SAMPLE_CHECK_PDF_RELATIVE_PATH)

const SYSTEM_FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
]

/** Google Fonts 経由の Noto Sans JP（CI / Linux 用） */
const NOTO_JP_TTF_URL =
  "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf"

function findSystemFont(): string | null {
  for (const p of SYSTEM_FONT_CANDIDATES) {
    if (existsSync(p)) return p
  }
  return null
}

async function downloadFont(url: string, dest: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`フォントの取得に失敗しました (${res.status})`)
  }
  await pipeline(
    Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
    createWriteStream(dest)
  )
}

async function loadFontBytes(): Promise<Uint8Array> {
  const local = findSystemFont()
  if (local) {
    console.error("[sample-pdf] font", { kind: "system", path: local })
    return new Uint8Array(readFileSync(local))
  }

  const cache = join(tmpdir(), "kansatsu-NotoSansJP-Regular.otf")
  if (!existsSync(cache)) {
    console.error("[sample-pdf] font", { kind: "download", url: NOTO_JP_TTF_URL })
    await downloadFont(NOTO_JP_TTF_URL, cache)
  } else {
    console.error("[sample-pdf] font", { kind: "cache", path: cache })
  }
  return new Uint8Array(readFileSync(cache))
}

async function main() {
  const fontBytes = await loadFontBytes()
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(fontBytes, { subset: true })

  pdf.setTitle("監査のミカタ 抽出確認用サンプル")
  pdf.setAuthor("監査のミカタ")
  pdf.setLanguage("ja")
  pdf.setCreationDate(new Date("2026-08-16T00:00:00Z"))
  pdf.setModificationDate(new Date("2026-08-16T00:00:00Z"))

  const page = pdf.addPage([595.28, 841.89])
  const { height } = page.getSize()
  const left = 56
  let y = height - 72

  for (const line of SAMPLE_CHECK_PDF_LINES) {
    if (!line) {
      y -= 14
      continue
    }
    const size = line === SAMPLE_CHECK_PDF_LINES[0] ? 16 : 12
    page.drawText(line, {
      x: left,
      y,
      size,
      font,
      color: rgb(0.06, 0.1, 0.12),
    })
    y -= size + 10
  }

  const bytes = await pdf.save({ useObjectStreams: false })
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, bytes)
  console.error("[sample-pdf] wrote", {
    path: SAMPLE_CHECK_PDF_RELATIVE_PATH,
    bytes: bytes.byteLength,
  })
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
