"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { PHASE1_MUNICIPALITIES } from "@/lib/phase1-audit"
import { toUserErrorMessage } from "@/lib/auth-errors"

export type UpdateSetupResult = {
  ok: boolean
  error?: string
}

/**
 * 事業所の自治体を更新（Phase1 対象市、またはスキップ＝全国寄り）。
 * 管理者のみ。
 */
export async function updateFacilityMunicipalityAction(input: {
  municipality: string | null
  skipMunicipality: boolean
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role, deleted_at")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.organization_id || profile.deleted_at) {
    return { ok: false, error: "事業所情報を取得できませんでした。" }
  }
  if (profile.role !== "admin") {
    return {
      ok: false,
      error: "自治体の変更は管理者のみ行えます。",
    }
  }

  let municipality: string | null = null
  if (!input.skipMunicipality) {
    const name = input.municipality?.trim() ?? ""
    if (!name) {
      return { ok: false, error: "自治体を選ぶか、「まだ決まっていない」を選んでください。" }
    }
    if (!(PHASE1_MUNICIPALITIES as readonly string[]).includes(name)) {
      return {
        ok: false,
        error:
          "第1フェーズでは横浜・川崎・藤沢・鎌倉・茅ヶ崎のいずれかを選んでください。",
      }
    }
    municipality = name
  }

  const { error } = await supabase
    .from("organizations")
    .update({ municipality })
    .eq("id", profile.organization_id)

  if (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }

  revalidatePath("/setup")
  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: true }
}
