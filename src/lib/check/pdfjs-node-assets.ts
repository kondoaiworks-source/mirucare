/**
 * 本番（Vercel）で日本語PDFを抜くための Node 側準備。
 * カスタム Factory クラスを渡すとワーカー側で「s is not a function」になるため、
 * CMap/フォントはファイルパスだけ渡し、Node 既定の読み込みに任せる。
 */

import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

export type PdfParseInstance = {
  getText: (params?: Record<string, unknown>) => Promise<{ text?: string }>
  getInfo: () => Promise<{ total?: number }>
  getScreenshot: (opts?: Record<string, unknown>) => Promise<unknown>
  destroy: () => Promise<void>
}

export type PdfParseCtor = (new (
  options: Record<string, unknown>
) => PdfParseInstance) & {
  setWorker?: (src: string) => string
}

const requireFromProject = createRequire(join(process.cwd(), "package.json"))

function withTrailingSlash(dir: string): string {
  return dir.endsWith("/") ? dir : `${dir}/`
}

function pdfParsePackageDir(): string | null {
  try {
    return dirname(requireFromProject.resolve("pdf-parse/package.json"))
  } catch {
    const fallback = join(process.cwd(), "node_modules", "pdf-parse")
    return existsSync(fallback) ? fallback : null
  }
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

function resolvePdfWorkerPath(): string | null {
  const roots: string[] = []
  try {
    roots.push(dirname(requireFromProject.resolve("pdfjs-dist/package.json")))
  } catch {
    // トレース漏れ時は cwd 側を試す
  }
  roots.push(join(process.cwd(), "node_modules", "pdfjs-dist"))
  for (const root of roots) {
    const worker = join(root, "legacy", "build", "pdf.worker.mjs")
    if (existsSync(worker)) return worker
  }
  return null
}

function readPdfParseCtor(): PdfParseCtor {
  const pkgDir = pdfParsePackageDir()
  const cjsPath = pkgDir
    ? join(pkgDir, "dist", "pdf-parse", "cjs", "index.cjs")
    : null
  const loaded: unknown = cjsPath
    ? requireFromProject(cjsPath)
    : requireFromProject("pdf-parse")
  const mod = loaded as {
    PDFParse?: PdfParseCtor
    default?: { PDFParse?: PdfParseCtor } | PdfParseCtor
  }
  const ctor =
    mod.PDFParse ??
    (typeof mod.default === "function"
      ? (mod.default as PdfParseCtor)
      : mod.default?.PDFParse)
  if (typeof ctor !== "function") {
    throw new Error("pdf-parse の読み込みに失敗しました。")
  }
  return ctor
}

let cachedCtor: PdfParseCtor | null = null
let loggedRuntime = false

/**
 * pdf-parse の browser 向けエントリを避け、Node の CJS を読む。
 */
export function loadPdfParse(): { PDFParse: PdfParseCtor } {
  if (cachedCtor) return { PDFParse: cachedCtor }
  const PDFParse = readPdfParseCtor()
  const workerSrc = resolvePdfWorkerPath()
  if (workerSrc && typeof PDFParse.setWorker === "function") {
    PDFParse.setWorker(workerSrc)
  }
  cachedCtor = PDFParse
  return { PDFParse }
}

export function pdfParseLoadOptions(buffer: Buffer): Record<string, unknown> {
  const cMapUrl = resolvePdfjsAssetDir("cmaps")
  const standardFontDataUrl = resolvePdfjsAssetDir("standard_fonts")
  if (!loggedRuntime) {
    loggedRuntime = true
    console.error("[extract] pdf_runtime", {
      node: process.version,
      hasCMapDir: Boolean(cMapUrl),
      hasFontDir: Boolean(standardFontDataUrl),
      hasWorker: Boolean(resolvePdfWorkerPath()),
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
  }
  if (standardFontDataUrl) {
    options.standardFontDataUrl = standardFontDataUrl
  }

  return options
}
