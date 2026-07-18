import { createHash } from "crypto"
import * as cheerio from "cheerio"

export type ExtractedWatchRow = {
  item_key: string
  title: string
  href: string
}

/** 相対URLを絶対化し、セッション系クエリを除去する */
export function normalizeWatchUrl(href: string, base: string): string {
  let absolute: string
  try {
    absolute = new URL(href, base).toString()
  } catch {
    return ""
  }
  try {
    const u = new URL(absolute)
    const drop = new Set([
      "sid",
      "sessionid",
      "phpsessid",
      "utm_source",
      "utm_medium",
      "utm_campaign",
    ])
    const kept: string[] = []
    u.searchParams.forEach((value, key) => {
      if (!drop.has(key.toLowerCase())) {
        kept.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      }
    })
    u.search = kept.length > 0 ? `?${kept.join("&")}` : ""
    u.hash = ""
    return u.toString()
  } catch {
    return absolute
  }
}

export function normalizeWatchText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

export function itemKeyForRow(title: string, href: string): string {
  return createHash("sha256")
    .update(`${title}|${href}`, "utf8")
    .digest("hex")
}

/**
 * 一覧HTMLから「行=記事1件」を抽出する。
 * 抽出0件は呼び出し側でセレクタ破損として扱うこと。
 */
export function extractWatchRows(
  html: string,
  selector: string,
  baseUrl: string
): ExtractedWatchRow[] {
  const $ = cheerio.load(html)
  const rows: ExtractedWatchRow[] = []
  const seen = new Set<string>()

  $(selector).each((_, el) => {
    const node = $(el)
    const title = normalizeWatchText(node.text())
    const a = node.find("a[href]").first()
    const hrefRaw = a.attr("href") ?? ""
    const href = hrefRaw ? normalizeWatchUrl(hrefRaw, baseUrl) : ""
    if (!title) return
    const item_key = itemKeyForRow(title, href)
    if (seen.has(item_key)) return
    seen.add(item_key)
    rows.push({ item_key, title, href })
  })

  return rows
}
