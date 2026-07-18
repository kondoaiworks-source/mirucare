"use server"

import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import {
  toUserErrorMessage,
  validateEmail,
  validatePassword,
} from "@/lib/auth-errors"
import {
  MSG_BAD_CREDENTIALS,
  MSG_LOCKED,
  clearLoginLockout,
  isLockoutActive,
  lookupLoginLockout,
  recordFailedLogin,
  writeAuthAuditLog,
} from "@/lib/login-lockout"
import type { ServiceType, UserRole } from "@/types/database"

export type ActionResult = {
  ok: boolean
  error?: string
  inviteUrl?: string
}

export async function signUpAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const displayName = String(formData.get("display_name") ?? "").trim()

  const emailError = validateEmail(email)
  if (emailError) return { ok: false, error: emailError }

  const passwordError = validatePassword(password)
  if (passwordError) return { ok: false, error: passwordError }

  if (!displayName) {
    return {
      ok: false,
      error:
        "お名前を入力してください。画面上の表示名として使います（例：山田 太郎）。",
    }
  }

  try {
    const supabase = createClient()
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })

    if (error) {
      return { ok: false, error: toUserErrorMessage(error) }
    }

    redirect("/onboarding")
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error
    }
    return { ok: false, error: toUserErrorMessage(error) }
  }
}

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "/")

  const emailError = validateEmail(email)
  if (emailError) return { ok: false, error: emailError }

  if (!password) {
    return {
      ok: false,
      error: "パスワードを入力してください。未入力のままではログインできません。",
    }
  }

  const normalizedEmail = email.trim().toLowerCase()

  try {
    const service = createServiceClient()
    let lockRow: Awaited<ReturnType<typeof lookupLoginLockout>> = null

    try {
      lockRow = await lookupLoginLockout(normalizedEmail, service)
    } catch (lookupError) {
      return { ok: false, error: toUserErrorMessage(lookupError) }
    }

    // 登録済みかつロック中 → Auth を呼ばず拒否（正解PWでも）
    if (lockRow && !lockRow.deleted_at) {
      if (
        lockRow.lockout_until &&
        !isLockoutActive(lockRow.lockout_until)
      ) {
        // 期限切れロックは遅延クリア
        await clearLoginLockout(lockRow.profile_id, service)
        lockRow = {
          ...lockRow,
          failed_login_attempts: 0,
          lockout_until: null,
        }
      }

      if (isLockoutActive(lockRow.lockout_until)) {
        return { ok: false, error: MSG_LOCKED }
      }
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error) {
      // 未登録メールはカウンタを持たない（情報漏洩防止）
      if (lockRow && !lockRow.deleted_at) {
        const result = await recordFailedLogin(
          lockRow.profile_id,
          lockRow.failed_login_attempts,
          normalizedEmail,
          service
        )
        if (result.locked) {
          return { ok: false, error: MSG_LOCKED }
        }
      }
      return { ok: false, error: MSG_BAD_CREDENTIALS }
    }

    // 成功 → カウンタ／ロックをリセット
    if (lockRow && !lockRow.deleted_at) {
      if (
        lockRow.failed_login_attempts > 0 ||
        lockRow.lockout_until
      ) {
        await clearLoginLockout(lockRow.profile_id, service)
        await writeAuthAuditLog({
          action: "login_success_reset",
          profileId: lockRow.profile_id,
          email: normalizedEmail,
          service,
        })
      }
    }

    const safeNext = next.startsWith("/") ? next : "/"
    redirect(safeNext)
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error
    }
    return { ok: false, error: toUserErrorMessage(error) }
  }
}

export async function signOutAction(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function completeOnboardingAction(input: {
  name: string
  serviceType: ServiceType
  municipality: string | null
  skipMunicipality: boolean
}): Promise<ActionResult> {
  const name = input.name.trim()
  if (name.length < 2) {
    return {
      ok: false,
      error:
        "事業所名が短すぎます。正式名称を2文字以上で入力してください（例：みらい訪問介護ステーション）。",
    }
  }

  if (!input.skipMunicipality && !input.municipality) {
    return {
      ok: false,
      error:
        "自治体が未選択です。一覧から選ぶか、「あとで設定」を押してください。",
    }
  }

  try {
    const supabase = createClient()
    const { error } = await supabase.rpc("complete_onboarding", {
      p_name: name,
      p_service_type: input.serviceType,
      p_municipality: input.municipality,
      p_skip_municipality: input.skipMunicipality,
    })

    if (error) {
      return { ok: false, error: toUserErrorMessage(error) }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }
}

export async function createInvitationAction(
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "")
  const role = (String(formData.get("role") ?? "staff") as UserRole) || "staff"

  const emailError = validateEmail(email)
  if (emailError) return { ok: false, error: emailError }

  if (role !== "admin" && role !== "staff") {
    return {
      ok: false,
      error: "役割の指定が正しくありません。管理者またはスタッフを選んでください。",
    }
  }

  try {
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single()

    if (profileError || !profile?.organization_id) {
      return {
        ok: false,
        error:
          "事業所情報を取得できませんでした。オンボーディングが完了しているかご確認ください。",
      }
    }

    if (profile.role !== "admin") {
      return {
        ok: false,
        error:
          "招待できるのは管理者のみです。管理者の方に招待をご依頼ください。",
      }
    }

    const { data: existing } = await supabase
      .from("invitations")
      .select("id, status")
      .eq("organization_id", profile.organization_id)
      .eq("email", email.trim().toLowerCase())
      .is("deleted_at", null)
      .maybeSingle()

    let invitation: { token: string } | null = null

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from("invitations")
        .update({
          role,
          status: "pending",
          invited_by: user.id,
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .eq("id", existing.id)
        .select("token")
        .single()

      if (updateError) {
        return { ok: false, error: toUserErrorMessage(updateError) }
      }
      invitation = updated
    } else {
      const { data: created, error } = await supabase
        .from("invitations")
        .insert({
          organization_id: profile.organization_id,
          email: email.trim().toLowerCase(),
          role,
          invited_by: user.id,
        })
        .select("token")
        .single()

      if (error) {
        return { ok: false, error: toUserErrorMessage(error) }
      }
      invitation = created
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
    return {
      ok: true,
      inviteUrl: `${origin}/invite/${invitation.token}`,
    }
  } catch (error) {
    return { ok: false, error: toUserErrorMessage(error) }
  }
}

export async function acceptInvitationAction(
  token: string
): Promise<ActionResult> {
  if (!token) {
    return {
      ok: false,
      error:
        "招待リンクが正しくありません。メールに記載のURLを再度ご確認ください。",
    }
  }

  try {
    const supabase = createClient()
    const { error } = await supabase.rpc("accept_invitation", {
      p_token: token,
    })

    if (error) {
      return { ok: false, error: toUserErrorMessage(error) }
    }

    redirect("/")
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error
    }
    return { ok: false, error: toUserErrorMessage(error) }
  }
}

export async function getCurrentProfile() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      id,
      organization_id,
      display_name,
      role,
      is_operator,
      created_at,
      updated_at,
      deleted_at,
      organizations (
        id,
        name,
        service_type,
        municipality,
        plan,
        skip_finding_review,
        stripe_customer_id,
        stripe_subscription_status,
        setup_fee_paid_at,
        onboarding_completed_at,
        created_at,
        deleted_at
      )
    `
    )
    .eq("id", user.id)
    .maybeSingle()

  return profile
}
