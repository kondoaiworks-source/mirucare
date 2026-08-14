import type {
  CityRulebookData,
  CityRulebookSource,
} from "@/app/actions/city-rulebook"

export type RulebookSourceLink = {
  key: string
  layer: "national" | "prefecture" | "city"
  layerLabel: string
  title: string
  url: string
}

const LAYER_ORDER = ["national", "prefecture", "city"] as const

function sourceUrl(source: CityRulebookSource): string | null {
  const url =
    source.direct_file_url?.trim() ||
    source.official_url?.trim() ||
    source.parent_page_url?.trim() ||
    ""
  return url || null
}

export function collectRulebookSourceLinks(
  data: CityRulebookData
): RulebookSourceLink[] {
  const seen = new Set<string>()
  const out: RulebookSourceLink[] = []

  const layerLabel = (layer: RulebookSourceLink["layer"]) => {
    if (layer === "national") return "国"
    if (layer === "prefecture") return data.city.prefectureName
    return data.city.name
  }

  for (const source of data.sources) {
    const url = sourceUrl(source)
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push({
      key: source.id,
      layer: source.layer,
      layerLabel: layerLabel(source.layer),
      title: source.title,
      url,
    })
  }

  for (const doc of data.documents) {
    const url = doc.source_url?.trim() || ""
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push({
      key: doc.id,
      layer: doc.layer,
      layerLabel: layerLabel(doc.layer),
      title: doc.title,
      url,
    })
  }

  return out
}

export function groupRulebookSourceLinks(
  data: CityRulebookData,
  links: RulebookSourceLink[]
): Array<{
  layer: (typeof LAYER_ORDER)[number]
  label: string
  items: RulebookSourceLink[]
}> {
  return LAYER_ORDER.map((layer) => ({
    layer,
    label:
      layer === "national"
        ? "国"
        : layer === "prefecture"
          ? data.city.prefectureName
          : data.city.name,
    items: links.filter((s) => s.layer === layer),
  }))
}

export function sourceListPath(
  serviceSlug: string,
  citySlug?: string | null
): string {
  const base = `/admin/rules/services/${serviceSlug}/sources`
  const slug = citySlug?.trim()
  if (!slug) return base
  return `${base}?city=${encodeURIComponent(slug)}`
}
