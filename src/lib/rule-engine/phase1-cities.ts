/**
 * Phase1 市ルールブック用の slug ↔ 名称 ↔ 管轄コード
 * @see docs/ルールブック構想.md
 */

export type Phase1City = {
  slug: string
  name: string
  code: string
  /** 共有層の都道府県名（知識台帳の region_name） */
  prefectureName: string
}

export const PHASE1_CITIES: readonly Phase1City[] = [
  {
    slug: "yokohama",
    name: "横浜市",
    code: "JP-14-14100",
    prefectureName: "神奈川県",
  },
  {
    slug: "kawasaki",
    name: "川崎市",
    code: "JP-14-14130",
    prefectureName: "神奈川県",
  },
  {
    slug: "fujisawa",
    name: "藤沢市",
    code: "JP-14-14205",
    prefectureName: "神奈川県",
  },
  {
    slug: "kamakura",
    name: "鎌倉市",
    code: "JP-14-14204",
    prefectureName: "神奈川県",
  },
  {
    slug: "chigasaki",
    name: "茅ヶ崎市",
    code: "JP-14-14207",
    prefectureName: "神奈川県",
  },
] as const

export function getPhase1CityBySlug(slug: string): Phase1City | undefined {
  return PHASE1_CITIES.find((c) => c.slug === slug)
}

export function isPhase1CitySlug(slug: string): boolean {
  return Boolean(getPhase1CityBySlug(slug))
}

/** 知識台帳の region_name（例：横浜市）から Phase1 の slug */
export function citySlugFromRegionName(
  regionName?: string | null
): string | null {
  const region = regionName?.trim() ?? ""
  if (!region) return null
  return (
    PHASE1_CITIES.find(
      (c) => region === c.name || region.includes(c.name)
    )?.slug ?? null
  )
}

export type SourceLayer = "national" | "prefecture" | "city"

/** 知識台帳の jurisdiction_level から資料庫の層 */
export function sourceLayerFromJurisdictionLevel(
  level?: string | null
): SourceLayer | null {
  const v = level?.trim() ?? ""
  if (v === "国" || v === "national") return "national"
  if (v === "都道府県" || v === "prefecture") return "prefecture"
  if (v === "市区町村" || v === "municipality") return "city"
  return null
}

export const NATIONAL_JURISDICTION_CODE = "JP"
export const KANAGAWA_JURISDICTION_CODE = "JP-14"
