"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { toUserErrorMessage } from "@/lib/auth-errors"
import { getPublishedRulebookCatalogAction } from "@/app/actions/rulebook-offerings"
import {
  isAllowedMunicipalitySelection,
  isAllowedServiceSelection,
} from "@/lib/rule-engine/offerings"
import type { ServiceType } from "@/types/database"

export type UpdateSetupResult = {
  ok: boolean
  error?: string
}

const SERVICE_TYPES: readonly ServiceType[] = ["訪問介護", "通所介護", "その他"]

async function requireAdminOrg() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false as const,
      error:
        "ログインの有効期限が切れた可能性があります。再度ログインしてください。",
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role, deleted_at")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.organization_id || profile.deleted_at) {
    return { ok: false as const, error: "事業所情報を取得できませんでした。" }
  }
  if (profile.role !== "admin") {
    return {
      ok: false as const,
      error: "事業所の設定変更は管理者のみ行えます。",
    }
  }

  return {
    ok: true as const,
    supabase,
    organizationId: profile.organization_id as string,
    userId: user.id,
  }
}

async function loadCatalogOrError() {
  const catalogResult = await getPublishedRulebookCatalogAction()
  if (!catalogResult.ok || !catalogResult.data) {
    return {
      ok: false as const,
      error:
        catalogResult.error ??
        "公開中の自治体一覧を取得できませんでした。しばらくしてから再度お試しください。",
    }
  }
  return { ok: true as const, catalog: catalogResult.data }
}

/**
 * 事業所の自治体を更新。管理者のみ。
 * 公開中の自治体、または既存値の据え置きのみ許可。
 */
export async function updateFacilityMunicipalityAction(input: {
  municipality: string | null
  skipMunicipality: boolean
}): Promise<UpdateSetupResult> {
  const auth = await requireAdminOrg()
  if (!auth.ok) return { ok: false, error: auth.error }

  const catalogLoad = await loadCatalogOrError()
  if (!catalogLoad.ok) return { ok: false, error: catalogLoad.error }

  const { data: org } = await auth.supabase
    .from("organizations")
    .select("municipality, service_type")
    .eq("id", auth.organizationId)
    .maybeSingle()

  const serviceType = (org?.service_type as ServiceType | null) ?? "訪問介護"
  const resolved = isAllowedMunicipalitySelection({
    catalog: catalogLoad.catalog,
    serviceType,
    municipality: input.municipality,
    skipMunicipality: input.skipMunicipality,
    existingMunicipality: org?.municipality ?? null,
  })
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const municipality = input.skipMunicipality
    ? null
    : input.municipality?.trim() || null

  const { error } = await auth.supabase
    .from("organizations")
    .update({ municipality })
    .eq("id", auth.organizationId)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: true }
}

/**
 * 事業所名／サービス種別／自治体をまとめて更新。管理者のみ。
 */
export async function updateFacilitySettingsAction(input: {
  name: string
  serviceType: ServiceType
  municipality: string | null
  skipMunicipality: boolean
}): Promise<UpdateSetupResult> {
  const auth = await requireAdminOrg()
  if (!auth.ok) return { ok: false, error: auth.error }

  const name = input.name.trim()
  if (name.length < 2) {
    return {
      ok: false,
      error:
        "事業所名が短すぎます。正式名称を2文字以上で入力してください（例：みらい訪問介護ステーション）。",
    }
  }
  if (name.length > 120) {
    return {
      ok: false,
      error: "事業所名が長すぎます。120文字以内で入力してください。",
    }
  }
  if (!SERVICE_TYPES.includes(input.serviceType)) {
    return {
      ok: false,
      error: "サービス種別を選んでください。",
    }
  }

  const catalogLoad = await loadCatalogOrError()
  if (!catalogLoad.ok) return { ok: false, error: catalogLoad.error }

  const { data: org } = await auth.supabase
    .from("organizations")
    .select("municipality, service_type")
    .eq("id", auth.organizationId)
    .maybeSingle()

  const serviceCheck = isAllowedServiceSelection({
    catalog: catalogLoad.catalog,
    serviceType: input.serviceType,
    existingServiceType: (org?.service_type as ServiceType | null) ?? null,
  })
  if (!serviceCheck.ok) return { ok: false, error: serviceCheck.error }

  const muniCheck = isAllowedMunicipalitySelection({
    catalog: catalogLoad.catalog,
    serviceType: input.serviceType,
    municipality: input.municipality,
    skipMunicipality: input.skipMunicipality,
    existingMunicipality: org?.municipality ?? null,
  })
  if (!muniCheck.ok) return { ok: false, error: muniCheck.error }

  const municipality = input.skipMunicipality
    ? null
    : input.municipality?.trim() || null

  const { error } = await auth.supabase
    .from("organizations")
    .update({
      name,
      service_type: input.serviceType,
      municipality,
    })
    .eq("id", auth.organizationId)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: true }
}

/**
 * ログイン中ユーザー自身の表示名を更新（個人名。事業所名とは別）。
 */
export async function updateDisplayNameAction(input: {
  displayName: string
}): Promise<UpdateSetupResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error:
        "ログインの有効期限が切れた可能性があります。再度ログインしてください。",
    }
  }

  const displayName = input.displayName.trim()
  if (displayName.length < 1) {
    return {
      ok: false,
      error:
        "お名前を入力してください。画面上の表示名として使います（例：山田 太郎）。",
    }
  }
  if (displayName.length > 40) {
    return {
      ok: false,
      error: "お名前が長すぎます。40文字以内で入力してください。",
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .is("deleted_at", null)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidatePath("/settings")
  return { ok: true }
}
