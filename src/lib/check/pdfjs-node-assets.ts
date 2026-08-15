/**
 * 本番（Vercel）で日本語PDFのCIDフォントを読むための Node 側資産。
 * pdf.js 既定の file:// / fetch はサーバーレスで例外になるため、fs で読む。
 */

import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

export type PdfParseCtor = new (options: Record<string, unknown>) => {
  getText: (params?: Record<string, unknown>) => Promise<{ text?: string }>
  getInfo: () => Promise<{ total?: number }>
  getScreenshot: (opts?: Record<string, unknown>) => Promise<unknown>
  destroy: () => Promise<void>
}

const requireFromProject = createRequire(join(process.cwd(), "package.json"))

function withTrailingSlash(dir: string): string {
  return dir.endsWith("/") ? dir : `${dir}/`
}

export function resolvePdfjsAssetDir(
  subdir: "cmaps" | "standard_fonts"
): string | null {
  const roots: string[] = []
  try {
    roots.push(dirname(requireFromProject.resolve("pdfjs-dist/package.json")))
  } catch {
    // トレース漏れ時は cwd 側を試す
  }
  roots.push(join(process.cwd(), "node_modules", "pdfjs-dist"))
  const taskRoot = process.env.LAMBDA_TASK_ROOT?.trim()
  if (taskRoot) {
    roots.push(join(taskRoot, "node_modules", "pdfjs-dist"))
  }

  for (const root of roots) {
    const dir = join(root, subdir)
    if (existsSync(dir)) return withTrailingSlash(dir)
  }
  return null
}

class NodeFsCMapReaderFactory {
  baseUrl: string | null
  isCompressed: boolean

  constructor(opts: { baseUrl?: string | null; isCompressed?: boolean }) {
    this.baseUrl = opts.baseUrl ?? null
    this.isCompressed = opts.isCompressed !== false
  }

  async fetch({ name }: { name: string }) {
    if (!this.baseUrl) {
      throw new Error("cMapUrl がありません。")
    }
    if (!name) {
      throw new Error("CMap 名がありません。")
    }
    const file = join(
      this.baseUrl,
      this.isCompressed ? `${name}.bcmap` : name
    )
    const buf = await readFile(file)
    return {
      cMapData: new Uint8Array(buf),
      isCompressed: this.isCompressed,
    }
  }
}

class NodeFsStandardFontDataFactory {
  baseUrl: string | null

  constructor(opts: { baseUrl?: string | null }) {
    this.baseUrl = opts.baseUrl ?? null
  }

  async fetch({ filename }: { filename: string }) {
    if (!this.baseUrl) {
      throw new Error("standardFontDataUrl がありません。")
    }
    if (!filename) {
      throw new Error("フォントファイル名がありません。")
    }
    const buf = await readFile(join(this.baseUrl, filename))
    return new Uint8Array(buf)
  }
}

/**
 * pdf-parse の browser 向けエントリを避け、Node の CJS を読む。
 */
export function loadPdfParse(): { PDFParse: PdfParseCtor } {
  return requireFromProject("pdf-parse") as { PDFParse: PdfParseCtor }
}

let loggedRuntime = false

export function pdfParseLoadOptions(buffer: Buffer): Record<string, unknown> {
  const cMapUrl = resolvePdfjsAssetDir("cmaps")
  const standardFontDataUrl = resolvePdfjsAssetDir("standard_fonts")
  if (!loggedRuntime) {
    loggedRuntime = true
    console.error("[extract] pdf_runtime", {
      node: process.version,
      hasCMapDir: Boolean(cMapUrl),
      hasFontDir: Boolean(standardFontDataUrl),
    })
  }

  const options: Record<string, unknown> = {
    data: Uint8Array.from(buffer),
    stopAtErrors: false,
    useWorkerFetch: false,
    useWasm: false,
    useSystemFonts: false,
    disableFontFace: true,
    isOffscreenCanvasSupported: false,
  }

  if (cMapUrl) {
    options.cMapUrl = cMapUrl
    options.cMapPacked = true
    options.CMapReaderFactory = NodeFsCMapReaderFactory
  }
  if (standardFontDataUrl) {
    options.standardFontDataUrl = standardFontDataUrl
    options.StandardFontDataFactory = NodeFsStandardFontDataFactory
  }

  return options
}
