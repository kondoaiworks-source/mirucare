/**
 * 根拠情報のカバー率。
 * 根拠カテゴリごとに資料を置いたかを、目視で確認するための指標。
 * 合否や「足りていること」の保証ではない。
 */

import type { RuleMaterialCategory } from "@/types/database"
import {
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABEL,
  isReadablePdfSource,
  primarySourceUrl,
} from "@/lib/rule-engine/source-urls"

export type EvidenceLayer = "national" | "prefecture" | "city"

export type EvidenceCoverageSource = {
  id?: string
  title?: string
  layer: EvidenceLayer
  material_category?: RuleMaterialCategory | null
  file_type?: string | null
  direct_file_url?: string | null
  parent_page_url?: string | null
  official_url?: string | null
  hasText?: boolean
}

export type EvidenceLayerCoverage = {
  layer: EvidenceLayer
  label: string
  pdfCount: number
  textCount: number
  filled: boolean
}

export type EvidenceCategorySource = {
  id: string
  title: string
  url: string | null
}

export type EvidenceCategoryCoverage = {
  category: RuleMaterialCategory
  label: string
  count: number
  recommended: boolean
  sources: EvidenceCategorySource[]
}

export type EvidenceCoverage = {
  /** 0〜100。国・県・市の読むPDFの有無（下書き・閲覧用） */
  percent: number
  /** 0〜100。根拠カテゴリのうち資料がある割合（根拠情報ページ用） */
  categoryPercent: number
  nationalPrefectureCount: number
  cityCount: number
  layers: EvidenceLayerCoverage[]
  categories: EvidenceCategoryCoverage[]
  recommendedCategories: EvidenceCategoryCoverage[]
  uncategorizedSources: EvidenceCategorySource[]
}

const LAYER_LABEL: Record<EvidenceLayer, string> = {
  national: "国",
  prefecture: "県",
  city: "市区町村",
}

function toCategorySource(source: EvidenceCoverageSource): EvidenceCategorySource {
  return {
    id: source.id?.trim() || source.title?.trim() || "unknown",
    title: source.title?.trim() || "（名称なし）",
    url: primarySourceUrl({
      direct_file_url: source.direct_file_url ?? null,
      parent_page_url: source.parent_page_url ?? null,
      official_url: source.official_url ?? null,
    }),
  }
}

export function buildEvidenceCoverage(
  sources: EvidenceCoverageSource[]
): EvidenceCoverage {
  const layers: EvidenceLayerCoverage[] = (
    ["national", "prefecture", "city"] as const
  ).map((layer) => {
    const layerSources = sources.filter((s) => s.layer === layer)
    const pdfs = layerSources.filter((s) => isReadablePdfSource(s))
    const textCount = pdfs.filter((s) => s.hasText === true).length
    return {
      layer,
      label: LAYER_LABEL[layer],
      pdfCount: pdfs.length,
      textCount,
      filled: pdfs.length > 0,
    }
  })

  const filledLayers = layers.filter((l) => l.filled).length
  const percent = Math.round((filledLayers / layers.length) * 100)

  const nationalPrefectureCount =
    (layers.find((l) => l.layer === "national")?.pdfCount ?? 0) +
    (layers.find((l) => l.layer === "prefecture")?.pdfCount ?? 0)
  const cityCount = layers.find((l) => l.layer === "city")?.pdfCount ?? 0

  const categories: EvidenceCategoryCoverage[] = MATERIAL_CATEGORIES.map(
    (category) => {
      const matched = sources.filter((s) => s.material_category === category)
      return {
        category,
        label: MATERIAL_CATEGORY_LABEL[category],
        count: matched.length,
        recommended: matched.length === 0,
        sources: matched.map(toCategorySource),
      }
    }
  )

  const filledCategories = categories.filter((c) => c.count > 0).length
  const categoryPercent = Math.round(
    (filledCategories / categories.length) * 100
  )

  const uncategorizedSources = sources
    .filter((s) => !s.material_category)
    .map(toCategorySource)

  return {
    percent,
    categoryPercent,
    nationalPrefectureCount,
    cityCount,
    layers,
    categories,
    recommendedCategories: categories.filter((c) => c.recommended),
    uncategorizedSources,
  }
}

export function coverageFromLayerCounts(input: {
  national: number
  prefecture: number
  city: number
}): Pick<
  EvidenceCoverage,
  "percent" | "nationalPrefectureCount" | "cityCount" | "layers"
> {
  const layers: EvidenceLayerCoverage[] = [
    {
      layer: "national",
      label: LAYER_LABEL.national,
      pdfCount: input.national,
      textCount: 0,
      filled: input.national > 0,
    },
    {
      layer: "prefecture",
      label: LAYER_LABEL.prefecture,
      pdfCount: input.prefecture,
      textCount: 0,
      filled: input.prefecture > 0,
    },
    {
      layer: "city",
      label: LAYER_LABEL.city,
      pdfCount: input.city,
      textCount: 0,
      filled: input.city > 0,
    },
  ]
  const filledLayers = layers.filter((l) => l.filled).length
  return {
    percent: Math.round((filledLayers / layers.length) * 100),
    nationalPrefectureCount: input.national + input.prefecture,
    cityCount: input.city,
    layers,
  }
}
