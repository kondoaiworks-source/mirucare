"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { PHASE1_MUNICIPALITIES } from "@/lib/phase1-audit"
import { toUserErrorMessage } from "@/lib/auth-errors"
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

function resolveMunicipality(input: {
  municipality: string | null
  skipMunicipality: boolean
  /** 既に登録済みの自治体（Phase1外でも据え置き可） */
  existingMunicipality?: string | null
}): { ok: true; municipality: string | null } | { ok: false; error: string } {
  if (input.skipMunicipality) {
    return { ok: true, municipality: null }
  }
  const name = input.municipality?.trim() ?? ""
  if (!name) {
    return {
      ok: false,
      error: "自治体を選ぶか、「まだ決まっていない」を選んでください。",
    }
  }
  const isPhase1 = (PHASE1_MUNICIPALITIES as readonly string[]).includes(name)
  const isUnchangedExisting =
    Boolean(input.existingMunicipality) && name === input.existingMunicipality
  if (!isPhase1 && !isUnchangedExisting) {
    return {
      ok: false,
      error:
        "第1フェーズでは横浜・川崎・藤沢・鎌倉・茅ヶ崎のいずれかを選んでください。",
    }
  }
  return { ok: true, municipality: name }
}

/**
 * 事業所の自治体を更新（Phase1 対象市、またはスキップ＝全国寄り）。
 * 管理者のみ。
 */
export async function updateFacilityMunicipalityAction(input: {
  municipality: string | null
  skipMunicipality: boolean
}): Promise<UpdateSetupResult> {
  const auth = await requireAdminOrg()
  if (!auth.ok) return { ok: false, error: auth.error }

  const { data: org } = await auth.supabase
    .from("organizations")
    .select("municipality")
    .eq("id", auth.organizationId)
    .maybeSingle()

  const resolved = resolveMunicipality({
    ...input,
    existingMunicipality: org?.municipality ?? null,
  })
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const { error } = await auth.supabase
    .from("organizations")
    .update({ municipality: resolved.municipality })
    .eq("id", auth.organizationId)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidatePath("/settings")
  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: true }
}

/**
 * 事業所名／サービス種別／自治体をまとめて更新。管理者のみ。
 * 事業所名は施設共通。個人の表示名とは別です。
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

  const { data: org } = await auth.supabase
    .from("organizations")
    .select("municipality")
    .eq("id", auth.organizationId)
    .maybeSingle()

  const resolved = resolveMunicipality({
    ...input,
    existingMunicipality: org?.municipality ?? null,
  })
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const { error } = await auth.supabase
    .from("organizations")
    .update({
      name,
      service_type: input.serviceType,
      municipality: resolved.municipality,
    })
    .eq("id", auth.organizationId)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidatePath("/settings")
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
  revalidatePath("/settings")
  return { ok: true }
}
