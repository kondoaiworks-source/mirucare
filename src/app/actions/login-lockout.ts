"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isCurrentUserOperator } from "@/lib/operator"
import {
  listLockedProfiles,
  unlockLoginForProfile,
  type LockedProfileListItem,
} from "@/lib/login-lockout"
import { toUserErrorMessage } from "@/lib/auth-errors"

export type UnlockActionResult = {
  ok: boolean
  error?: string
  status?: number
}

async function resolveActorContext(): Promise<
  | {
      ok: true
      profileId: string
      organizationId: string | null
      isOperator: boolean
      isOrgAdmin: boolean
    }
  | { ok: false; error: string }
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error: "ログインの有効期限が切れた可能性があります。再度ログインしてください。",
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role, is_operator, deleted_at")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || profile.deleted_at) {
    return { ok: false, error: "プロフィールを取得できませんでした。" }
  }

  const isOperator = await isCurrentUserOperator()
  const isOrgAdmin = profile.role === "admin"

  return {
    ok: true,
    profileId: profile.id,
    organizationId: profile.organization_id,
    isOperator,
    isOrgAdmin,
  }
}

export async function listLockedUsersAction(): Promise<{
  ok: boolean
  error?: string
  data?: LockedProfileListItem[]
}> {
  const actor = await resolveActorContext()
  if (!actor.ok) return { ok: false, error: actor.error }

  if (!actor.isOperator && !actor.isOrgAdmin) {
    return { ok: false, error: "一覧を見る権限がありません。" }
  }

  try {
    const data = await listLockedProfiles({
      actorProfileId: actor.profileId,
      actorOrganizationId: actor.organizationId,
      isOperator: actor.isOperator,
      isOrgAdmin: actor.isOrgAdmin,
    })
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }
}

export async function unlockUserLoginAction(
  targetProfileId: string
): Promise<UnlockActionResult> {
  const actor = await resolveActorContext()
  if (!actor.ok) return { ok: false, error: actor.error, status: 401 }

  const result = await unlockLoginForProfile({
    targetProfileId,
    actorProfileId: actor.profileId,
    actorOrganizationId: actor.organizationId,
    isOperator: actor.isOperator,
    isOrgAdmin: actor.isOrgAdmin,
  })

  if (!result.ok) {
    return { ok: false, error: result.error, status: result.status }
  }

  revalidatePath("/settings")
  return { ok: true }
}
