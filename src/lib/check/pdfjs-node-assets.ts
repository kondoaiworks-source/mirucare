/**
 * Node 上の pdfjs-dist 資産（日本語 CMap / 標準フォント）。
 * Factory クラスは渡さない（本番ワーカーで TypeError になるためパスだけ使う）。
 * pdf-parse の読み込みはスキャンPDFの画像化だけに使う。
 */

import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

export type PdfParseInstance = {
  getScreenshot: (opts?: Record<string, unknown>) => Promise<unknown>
  destroy: () => Promise<void>
}

export type PdfParseCtor = new (
  options: Record<string, unknown>
) => PdfParseInstance

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

/** スキャン画像化用。本文抽出では使わない。 */
export function loadPdfParse(): { PDFParse: PdfParseCtor } {
  if (cachedCtor) return { PDFParse: cachedCtor }
  cachedCtor = readPdfParseCtor()
  return { PDFParse: cachedCtor }
}

function pdfjsPathOptions(): Record<string, unknown> {
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
  const options: Record<string, unknown> = {}
  if (cMapUrl) {
    options.cMapUrl = cMapUrl
    options.cMapPacked = true
  }
  if (standardFontDataUrl) {
    options.standardFontDataUrl = standardFontDataUrl
  }
  return options
}

/** unpdf 本文抽出用。file:// や Factory クラスは渡さない。 */
export function unpdfDocumentOptions(): Record<string, unknown> {
  return {
    stopAtErrors: false,
    useWorkerFetch: false,
    useWasm: false,
    useSystemFonts: false,
    disableFontFace: true,
    isOffscreenCanvasSupported: false,
    ...pdfjsPathOptions(),
  }
}

/** スキャン画像化用。本文抽出では使わない。 */
export function pdfParseLoadOptions(buffer: Buffer): Record<string, unknown> {
  return {
    data: Uint8Array.from(buffer),
    stopAtErrors: false,
    useWorkerFetch: false,
    useWasm: false,
    useSystemFonts: false,
    disableFontFace: true,
    isOffscreenCanvasSupported: false,
    ...pdfjsPathOptions(),
  }
}
