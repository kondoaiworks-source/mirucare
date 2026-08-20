/**
 * 根拠情報のカバー率。
 * 監査に必要な公式PDF（国・県・市）を置いたかを、目視で確認するための指標。
 * 合否や「足りていること」の保証ではない。
 */

import type { RuleMaterialCategory } from "@/types/database"
import {
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABEL,
  isReadablePdfSource,
} from "@/lib/rule-engine/source-urls"

export type EvidenceLayer = "national" | "prefecture" | "city"

export type EvidenceCoverageSource = {
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

export type EvidenceCategoryCoverage = {
  category: RuleMaterialCategory
  label: string
  count: number
  recommended: boolean
}

export type EvidenceCoverage = {
  /** 0〜100。国・県・市の読むPDFの有無 */
  percent: number
  nationalPrefectureCount: number
  cityCount: number
  layers: EvidenceLayerCoverage[]
  categories: EvidenceCategoryCoverage[]
  recommendedCategories: EvidenceCategoryCoverage[]
}

const LAYER_LABEL: Record<EvidenceLayer, string> = {
  national: "国",
  prefecture: "県",
  city: "市区町村",
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
      const count = sources.filter((s) => s.material_category === category)
        .length
      return {
        category,
        label: MATERIAL_CATEGORY_LABEL[category],
        count,
        recommended: count === 0,
      }
    }
  )

  return {
    percent,
    nationalPrefectureCount,
    cityCount,
    layers,
    categories,
    recommendedCategories: categories.filter((c) => c.recommended),
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
