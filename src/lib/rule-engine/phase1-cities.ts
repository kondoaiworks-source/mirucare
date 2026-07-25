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

export const NATIONAL_JURISDICTION_CODE = "JP"
export const KANAGAWA_JURISDICTION_CODE = "JP-14"
