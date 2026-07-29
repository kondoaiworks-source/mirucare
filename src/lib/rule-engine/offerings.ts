/**
 * ルールブック提供カタログ（サービス × 自治体の公開）
 * - 公開中のみ新規施設が選択可能
 * - 非公開後も既存施設の設定は据え置き
 * - 市公開の前提：国・県に公開情報PDFがあること
 */

import type { ServiceType } from "@/types/database"
import {
  KANAGAWA_JURISDICTION_CODE,
  NATIONAL_JURISDICTION_CODE,
  PHASE1_CITIES,
} from "@/lib/rule-engine/phase1-cities"

export type RulebookOfferingRow = {
  id: string
  serviceType: ServiceType
  jurisdictionId: string
  jurisdictionCode: string
  municipalityName: string
  prefectureName: string
  isPublished: boolean
  publishedAt: string | null
  /** 市の公開情報PDF件数（active） */
  cityPdfCount: number
  /** 国の公開情報PDF件数（当該サービス） */
  nationalPdfCount: number
  /** 県の公開情報PDF件数（当該サービス） */
  prefecturePdfCount: number
  /** 公開可能な状態か（国・県・市にPDFあり） */
  canPublish: boolean
  publishBlockers: string[]
  slug: string | null
}

export type PublishedCatalog = {
  services: ServiceType[]
  municipalitiesByService: Record<
    ServiceType,
    Array<{ name: string; prefectureName: string; label: string }>
  >
}

export const OFFERING_SERVICE_TYPES: ServiceType[] = [
  "訪問介護",
  "通所介護",
  "その他",
]

export function citySlugForCode(code: string): string | null {
  return PHASE1_CITIES.find((c) => c.code === code)?.slug ?? null
}

export function evaluatePublishReadiness(input: {
  nationalPdfCount: number
  prefecturePdfCount: number
  cityPdfCount: number
}): { canPublish: boolean; blockers: string[] } {
  const blockers: string[] = []
  if (input.nationalPdfCount < 1) {
    blockers.push(
      "共通層（国）に公開情報PDFがありません。国の参照を先に登録してください。"
    )
  }
  if (input.prefecturePdfCount < 1) {
    blockers.push(
      "共通層（県）に公開情報PDFがありません。県の参照を先に登録してください。"
    )
  }
  if (input.cityPdfCount < 1) {
    blockers.push(
      "この市の公開情報PDFがありません。市ルールブックの自治体ルール設定で登録してください。"
    )
  }
  return { canPublish: blockers.length === 0, blockers }
}

export function buildPublishedCatalog(
  rows: Array<{
    serviceType: ServiceType
    municipalityName: string
    prefectureName: string
    isPublished: boolean
  }>
): PublishedCatalog {
  const municipalitiesByService = {
    訪問介護: [],
    通所介護: [],
    その他: [],
  } as PublishedCatalog["municipalitiesByService"]

  for (const row of rows) {
    if (!row.isPublished) continue
    const name = row.municipalityName.trim()
    if (!name) continue
    const list = municipalitiesByService[row.serviceType]
    if (list.some((m) => m.name === name)) continue
    list.push({
      name,
      prefectureName: row.prefectureName,
      label: row.prefectureName
        ? `${row.prefectureName} ${name}`
        : name,
    })
  }

  const services = OFFERING_SERVICE_TYPES.filter(
    (s) => municipalitiesByService[s].length > 0
  )

  return { services, municipalitiesByService }
}

/** 新規選択として許可されるか（公開中） */
export function isPublishedPair(
  catalog: PublishedCatalog,
  serviceType: ServiceType,
  municipality: string | null
): boolean {
  if (!municipality?.trim()) return true // スキップ可
  const list = catalog.municipalitiesByService[serviceType] ?? []
  return list.some((m) => m.name === municipality.trim())
}

/**
 * 設定変更時：公開中、または既存値の据え置きならOK
 */
export function isAllowedMunicipalitySelection(input: {
  catalog: PublishedCatalog
  serviceType: ServiceType
  municipality: string | null
  skipMunicipality: boolean
  existingMunicipality?: string | null
}): { ok: true } | { ok: false; error: string } {
  if (input.skipMunicipality || !input.municipality?.trim()) {
    return { ok: true }
  }
  const name = input.municipality.trim()
  if (isPublishedPair(input.catalog, input.serviceType, name)) {
    return { ok: true }
  }
  if (
    input.existingMunicipality?.trim() &&
    input.existingMunicipality.trim() === name
  ) {
    return { ok: true }
  }
  return {
    ok: false,
    error:
      "この自治体は現在公開されていません。公開中の自治体から選んでください。",
  }
}

export function isAllowedServiceSelection(input: {
  catalog: PublishedCatalog
  serviceType: ServiceType
  existingServiceType?: ServiceType | null
}): { ok: true } | { ok: false; error: string } {
  if (input.catalog.services.includes(input.serviceType)) {
    return { ok: true }
  }
  if (
    input.existingServiceType &&
    input.existingServiceType === input.serviceType
  ) {
    return { ok: true }
  }
  return {
    ok: false,
    error:
      "このサービス種別は現在公開されていません。公開中のサービスから選んでください。",
  }
}

export { NATIONAL_JURISDICTION_CODE, KANAGAWA_JURISDICTION_CODE }
