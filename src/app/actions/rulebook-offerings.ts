"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { requireOperator } from "@/lib/operator"
import { toUserErrorMessage } from "@/lib/auth-errors"
import {
  buildPublishedCatalog,
  citySlugForCode,
  evaluatePublishReadiness,
  type PublishedCatalog,
  type RulebookOfferingRow,
} from "@/lib/rule-engine/offerings"
import {
  KANAGAWA_JURISDICTION_CODE,
  NATIONAL_JURISDICTION_CODE,
  PHASE1_CITIES,
} from "@/lib/rule-engine/phase1-cities"
import type { ServiceType } from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

function revalidateOfferingPaths() {
  revalidatePath("/admin/rules/municipalities")
  revalidatePath("/admin/rules/regulatory")
  revalidatePath("/admin/rules/services", "layout")
  revalidatePath("/onboarding")
  revalidatePath("/settings")
}

async function countPdfSources(opts: {
  service: ReturnType<typeof createServiceClient>
  jurisdictionIds: string[]
  serviceType: ServiceType
}): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const id of opts.jurisdictionIds) counts.set(id, 0)
  if (opts.jurisdictionIds.length === 0) return counts

  const { data, error } = await opts.service
    .from("rule_sources")
    .select("jurisdiction_id, direct_file_url, file_type")
    .eq("status", "active")
    .eq("service_type", opts.serviceType)
    .in("jurisdiction_id", opts.jurisdictionIds)

  if (error) throw error

  for (const row of data ?? []) {
    const url = String(row.direct_file_url ?? "").trim()
    const fileType = String(row.file_type ?? "")
    const isPdf =
      Boolean(url) &&
      (fileType === "pdf" ||
        url.toLowerCase().includes(".pdf") ||
        url.toLowerCase().includes("application/pdf"))
    if (!isPdf) continue
    const jid = String(row.jurisdiction_id)
    counts.set(jid, (counts.get(jid) ?? 0) + 1)
  }
  return counts
}

/**
 * 運営：サービス×市の提供カタログ一覧（公開状態・公開可否）
 */
export async function listRulebookOfferingsAction(input?: {
  serviceType?: ServiceType
}): Promise<ActionResult<{ rows: RulebookOfferingRow[] }>> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  const serviceType = input?.serviceType ?? "訪問介護"

  try {
    const codes = PHASE1_CITIES.map((c) => c.code)
    const { data: jurisdictions, error: jErr } = await op.service
      .from("rule_jurisdictions")
      .select("id, code, name, municipality_name, prefecture_name, parent_id")
      .in("code", [
        ...codes,
        NATIONAL_JURISDICTION_CODE,
        KANAGAWA_JURISDICTION_CODE,
      ])

    if (jErr) return { ok: false, error: toUserErrorMessage(jErr) }

    const byCode = new Map(
      (jurisdictions ?? []).map((j) => [String(j.code), j])
    )
    const national = byCode.get(NATIONAL_JURISDICTION_CODE)
    const prefecture = byCode.get(KANAGAWA_JURISDICTION_CODE)
    const cities = PHASE1_CITIES.map((c) => byCode.get(c.code)).filter(Boolean)

    // 欠けている市の offering 行を確保
    for (const city of cities) {
      if (!city) continue
      await op.service.from("rulebook_offerings").upsert(
        {
          service_type: serviceType,
          jurisdiction_id: city.id,
          is_published: false,
        },
        { onConflict: "service_type,jurisdiction_id", ignoreDuplicates: true }
      )
    }

    const cityIds = cities.map((c) => String(c!.id))
    const sharedIds = [national?.id, prefecture?.id]
      .filter(Boolean)
      .map(String)

    const pdfCounts = await countPdfSources({
      service: op.service,
      jurisdictionIds: [...cityIds, ...sharedIds],
      serviceType,
    })

    const { data: offerings, error: oErr } = await op.service
      .from("rulebook_offerings")
      .select(
        "id, service_type, jurisdiction_id, is_published, published_at, unpublished_at"
      )
      .eq("service_type", serviceType)
      .in("jurisdiction_id", cityIds)

    if (oErr) return { ok: false, error: toUserErrorMessage(oErr) }

    const offeringByJid = new Map(
      (offerings ?? []).map((o) => [String(o.jurisdiction_id), o])
    )

    const nationalPdf = national
      ? (pdfCounts.get(String(national.id)) ?? 0)
      : 0
    const prefecturePdf = prefecture
      ? (pdfCounts.get(String(prefecture.id)) ?? 0)
      : 0

    const rows: RulebookOfferingRow[] = PHASE1_CITIES.map((city) => {
      const jur = byCode.get(city.code)
      const offering = jur ? offeringByJid.get(String(jur.id)) : undefined
      const cityPdf = jur ? (pdfCounts.get(String(jur.id)) ?? 0) : 0
      const readiness = evaluatePublishReadiness({
        nationalPdfCount: nationalPdf,
        prefecturePdfCount: prefecturePdf,
        cityPdfCount: cityPdf,
      })
      return {
        id: offering ? String(offering.id) : "",
        serviceType,
        jurisdictionId: jur ? String(jur.id) : "",
        jurisdictionCode: city.code,
        municipalityName: city.name,
        prefectureName: city.prefectureName,
        isPublished: Boolean(offering?.is_published),
        publishedAt: offering?.published_at
          ? String(offering.published_at)
          : null,
        cityPdfCount: cityPdf,
        nationalPdfCount: nationalPdf,
        prefecturePdfCount: prefecturePdf,
        canPublish: readiness.canPublish,
        publishBlockers: readiness.blockers,
        slug: citySlugForCode(city.code),
      }
    })

    return { ok: true, data: { rows } }
  } catch (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }
}

/**
 * 運営：公開／非公開を切り替える
 */
export async function setRulebookOfferingPublishedAction(input: {
  serviceType: ServiceType
  jurisdictionId: string
  publish: boolean
}): Promise<ActionResult> {
  const op = await requireOperator()
  if ("error" in op) return { ok: false, error: op.error }

  if (!input.jurisdictionId.trim()) {
    return { ok: false, error: "自治体が指定されていません。" }
  }

  try {
    if (input.publish) {
      const listed = await listRulebookOfferingsAction({
        serviceType: input.serviceType,
      })
      if (!listed.ok || !listed.data) {
        return { ok: false, error: listed.error ?? "公開条件を確認できません。" }
      }
      const row = listed.data.rows.find(
        (r) => r.jurisdictionId === input.jurisdictionId
      )
      if (!row) {
        return { ok: false, error: "対象の自治体が見つかりません。" }
      }
      if (!row.canPublish) {
        return {
          ok: false,
          error:
            row.publishBlockers[0] ??
            "公開の前提（国・県・市の公開情報PDF）が揃っていません。",
        }
      }
    }

    const now = new Date().toISOString()
    const { data: existing } = await op.service
      .from("rulebook_offerings")
      .select("id, published_at")
      .eq("service_type", input.serviceType)
      .eq("jurisdiction_id", input.jurisdictionId)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await op.service
        .from("rulebook_offerings")
        .update({
          is_published: input.publish,
          published_at: input.publish
            ? (existing.published_at ?? now)
            : existing.published_at,
          unpublished_at: input.publish ? null : now,
        })
        .eq("id", existing.id)
      if (error) return { ok: false, error: toUserErrorMessage(error) }
    } else {
      const { error } = await op.service.from("rulebook_offerings").insert({
        service_type: input.serviceType,
        jurisdiction_id: input.jurisdictionId,
        is_published: input.publish,
        published_at: input.publish ? now : null,
        unpublished_at: input.publish ? null : now,
      })
      if (error) return { ok: false, error: toUserErrorMessage(error) }
    }

    revalidateOfferingPaths()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }
}

/**
 * 施設向け：公開中のサービス・自治体カタログ
 *（ログイン済みなら参照可。未ログイン時はサービスロールで公開分のみ）
 */
export async function getPublishedRulebookCatalogAction(): Promise<
  ActionResult<PublishedCatalog>
> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // 認証ユーザーは RLS で公開行を読める。念のためサービスでも読めるようにする
    const reader = user ? supabase : createServiceClient()

    const { data, error } = await reader
      .from("rulebook_offerings")
      .select(
        `
        service_type,
        is_published,
        rule_jurisdictions (
          municipality_name,
          prefecture_name,
          name,
          level
        )
      `
      )
      .eq("is_published", true)

    if (error) return { ok: false, error: toUserErrorMessage(error) }

    const rows: Array<{
      serviceType: ServiceType
      municipalityName: string
      prefectureName: string
      isPublished: boolean
    }> = []

    for (const row of data ?? []) {
      const jurRaw = row.rule_jurisdictions as
        | {
            municipality_name: string | null
            prefecture_name: string | null
            name: string
            level: string
          }
        | {
            municipality_name: string | null
            prefecture_name: string | null
            name: string
            level: string
          }[]
        | null
      const jur = Array.isArray(jurRaw) ? jurRaw[0] : jurRaw
      if (!jur || jur.level !== "municipality") continue
      rows.push({
        serviceType: row.service_type as ServiceType,
        municipalityName: String(jur.municipality_name ?? jur.name ?? ""),
        prefectureName: String(jur.prefecture_name ?? ""),
        isPublished: true,
      })
    }

    return { ok: true, data: buildPublishedCatalog(rows) }
  } catch (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }
}
