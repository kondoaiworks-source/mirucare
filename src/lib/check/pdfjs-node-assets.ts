/**
 * Node 上の pdfjs-dist 資産（日本語 CMap / 標準フォント）。
 * unpdf（サーバーレス寄りのpdf.js）は file:// URL、pdf-parse はファイルパス。
 * Factory クラスはワーカーへ渡せないため使わない。
 */

import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"

export type PdfParseInstance = {
  getScreenshot: (opts?: Record<string, unknown>) => Promise<unknown>
  getText: (opts?: Record<string, unknown>) => Promise<{ text?: string }>
  destroy: () => Promise<void>
}

export type PdfParseCtor = (new (
  options: Record<string, unknown>
) => PdfParseInstance) & {
  setWorker?: (workerSrc?: string) => string
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

/** pdf.js の fetch 向け。末尾スラッシュ必須（CMap 名を連結するため） */
export function toPdfjsDirUrl(dir: string | null): string | null {
  if (!dir) return null
  const trimmed = dir.endsWith("/") ? dir.slice(0, -1) : dir
  const href = pathToFileURL(trimmed).href
  return href.endsWith("/") ? href : `${href}/`
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

function pdfjsWorkerSrc(): string | null {
  try {
    return requireFromProject.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    )
  } catch {
    const fallback = join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs"
    )
    return existsSync(fallback) ? fallback : null
  }
}

let cachedCtor: PdfParseCtor | null = null
let loggedRuntime = false

/** unpdf が別バージョンの worker を載せるので、使う直前に 5.4 へ戻す */
export function loadPdfParse(): { PDFParse: PdfParseCtor } {
  if (!cachedCtor) cachedCtor = readPdfParseCtor()
  const workerSrc = pdfjsWorkerSrc()
  if (workerSrc && typeof cachedCtor.setWorker === "function") {
    cachedCtor.setWorker(workerSrc)
  }
  return { PDFParse: cachedCtor }
}

function pdfjsAssetLocations(): {
  cMapDir: string | null
  fontDir: string | null
} {
  const cMapDir = resolvePdfjsAssetDir("cmaps")
  const fontDir = resolvePdfjsAssetDir("standard_fonts")
  if (!loggedRuntime) {
    loggedRuntime = true
    console.error("[extract] pdf_runtime", {
      node: process.version,
      hasCMapDir: Boolean(cMapDir),
      hasFontDir: Boolean(fontDir),
      hasWorker: Boolean(pdfjsWorkerSrc()),
      cMapUrlKind: cMapDir ? "file" : "missing",
    })
  }
  return { cMapDir, fontDir }
}

/** unpdf 本文抽出用。file:// にして fetch できるようにする。 */
export function unpdfDocumentOptions(): Record<string, unknown> {
  const { cMapDir, fontDir } = pdfjsAssetLocations()
  const cMapUrl = toPdfjsDirUrl(cMapDir)
  const standardFontDataUrl = toPdfjsDirUrl(fontDir)
  const options: Record<string, unknown> = {
    stopAtErrors: false,
    useWorkerFetch: false,
    useWasm: false,
    useSystemFonts: true,
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

/** pdf-parse 用。Node の readFile はファイルパスを使う。 */
export function pdfParseLoadOptions(buffer: Buffer): Record<string, unknown> {
  const { cMapDir, fontDir } = pdfjsAssetLocations()
  const options: Record<string, unknown> = {
    data: Uint8Array.from(buffer),
    stopAtErrors: false,
    useWorkerFetch: false,
    useWasm: false,
    useSystemFonts: true,
    disableFontFace: true,
    isOffscreenCanvasSupported: false,
  }
  if (cMapDir) {
    options.cMapUrl = cMapDir
    options.cMapPacked = true
  }
  if (fontDir) {
    options.standardFontDataUrl = fontDir
  }
  return options
}
