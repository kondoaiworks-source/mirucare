/**
 * Node 上の pdfjs-dist 資産（日本語 CMap）。
 * Factory クラスはワーカーへ渡せない。file:// も本番で例外になる。
 * 本文抜き（unpdf）は HTTP の /pdfjs/cmaps/ を fetch する。
 */

function withTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`
}

/** 本番（Vercel）または SITE_URL。テストでは未設定なら null */
export function publicAssetOrigin(): string | null {
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "")
    return `https://${host}`
  }
  if (process.env.VERCEL === "1") {
    const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
    if (prod) {
      const host = prod.replace(/^https?:\/\//, "")
      return `https://${host}`
    }
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (site && process.env.VITEST !== "true") {
    return site.replace(/\/$/, "")
  }
  return null
}

/** pdf.js の fetch 向け。末尾スラッシュ必須 */
export function resolvePublicPdfjsCmapUrl(): string | null {
  const origin = publicAssetOrigin()
  if (!origin) return null
  return withTrailingSlash(`${origin}/pdfjs/cmaps`)
}

let loggedRuntime = false

/** unpdf 本文抽出用。HTTP の CMap のみ渡す（Factory / file:// は渡さない） */
export function unpdfDocumentOptions(): Record<string, unknown> {
  const cMapUrl = resolvePublicPdfjsCmapUrl()
  if (!loggedRuntime) {
    loggedRuntime = true
    console.error("[extract] pdf_runtime", {
      node: process.version,
      cMapUrlKind: cMapUrl ? "http" : "missing",
    })
  }
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
  return options
}
