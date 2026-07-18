import { createHash } from "crypto"
import { createServiceClient } from "@/lib/supabase/server"

export const MAX_FAILED_LOGINS = 5
export const LOCKOUT_MINUTES = 15

export const MSG_BAD_CREDENTIALS =
  "メールアドレスまたはパスワードが正しくありません。入力内容をご確認ください。"

export const MSG_LOCKED =
  "ログイン試行が制限されています。しばらく時間をおいてから再度お試しください（約15分）。管理者に解除を依頼することもできます。"

export type LoginLockoutRow = {
  profile_id: string
  failed_login_attempts: number
  lockout_until: string | null
  organization_id: string | null
  role: "admin" | "staff"
  is_operator: boolean
  deleted_at: string | null
}

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function hashEmail(email: string): string {
  return createHash("sha256")
    .update(normalizeLoginEmail(email), "utf8")
    .digest("hex")
}

/** 表示用マスク（例: ko***@gmail.com） */
export function maskEmail(email: string): string {
  const normalized = normalizeLoginEmail(email)
  const at = normalized.indexOf("@")
  if (at <= 0) return "***"
  const local = normalized.slice(0, at)
  const domain = normalized.slice(at + 1)
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}***@${domain}`
}

export function isLockoutActive(lockoutUntil: string | null | undefined): boolean {
  if (!lockoutUntil) return false
  return new Date(lockoutUntil).getTime() > Date.now()
}

type ServiceClient = ReturnType<typeof createServiceClient>

export async function lookupLoginLockout(
  email: string,
  service: ServiceClient = createServiceClient()
): Promise<LoginLockoutRow | null> {
  const { data, error } = await service.rpc("lookup_login_lockout", {
    p_email: normalizeLoginEmail(email),
  })

  if (error) {
    console.error("[login-lockout] lookup_failed", {
      message: error.message.slice(0, 120),
    })
    // マイグレーション未適用時はロック判定をスキップ（ログイン自体は許可）
    if (
      error.message.includes("Could not find the function") ||
      error.message.includes("schema cache")
    ) {
      return null
    }
    throw new Error(
      "ログイン状態の確認に失敗しました。しばらくしてから再度お試しください。"
    )
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object") return null

  const r = row as Record<string, unknown>
  if (typeof r.profile_id !== "string") return null

  return {
    profile_id: r.profile_id,
    failed_login_attempts: Number(r.failed_login_attempts ?? 0),
    lockout_until:
      typeof r.lockout_until === "string" ? r.lockout_until : null,
    organization_id:
      typeof r.organization_id === "string" ? r.organization_id : null,
    role: r.role === "admin" ? "admin" : "staff",
    is_operator: r.is_operator === true,
    deleted_at: typeof r.deleted_at === "string" ? r.deleted_at : null,
  }
}

export async function clearLoginLockout(
  profileId: string,
  service: ServiceClient = createServiceClient()
): Promise<void> {
  const { error } = await service
    .from("profiles")
    .update({
      failed_login_attempts: 0,
      lockout_until: null,
    })
    .eq("id", profileId)

  if (error) {
    console.error("[login-lockout] clear_failed", {
      message: error.message.slice(0, 120),
    })
    throw new Error("ロック解除に失敗しました。")
  }
}

export async function recordFailedLogin(
  profileId: string,
  currentAttempts: number,
  email: string,
  service: ServiceClient = createServiceClient()
): Promise<{ locked: boolean; lockoutUntil: string | null; attempts: number }> {
  const attempts = currentAttempts + 1
  let lockoutUntil: string | null = null
  let locked = false

  if (attempts >= MAX_FAILED_LOGINS) {
    lockoutUntil = new Date(
      Date.now() + LOCKOUT_MINUTES * 60 * 1000
    ).toISOString()
    locked = true
  }

  const { error } = await service
    .from("profiles")
    .update({
      failed_login_attempts: attempts,
      lockout_until: lockoutUntil,
    })
    .eq("id", profileId)

  if (error) {
    console.error("[login-lockout] record_failed", {
      message: error.message.slice(0, 120),
    })
  }

  if (locked) {
    await writeAuthAuditLog({
      action: "login_lockout",
      profileId,
      email,
      meta: {
        failed_attempts: attempts,
        lockout_until: lockoutUntil,
        lockout_minutes: LOCKOUT_MINUTES,
      },
      service,
    })
  }

  return { locked, lockoutUntil, attempts }
}

export async function writeAuthAuditLog(opts: {
  action:
    | "login_lockout"
    | "login_unlock"
    | "login_success_reset"
    | "login_failed"
  profileId?: string | null
  email?: string | null
  actorProfileId?: string | null
  meta?: Record<string, unknown>
  service?: ServiceClient
}): Promise<void> {
  const service = opts.service ?? createServiceClient()
  const email = opts.email ? normalizeLoginEmail(opts.email) : null

  const { error } = await service.from("auth_audit_log").insert({
    action: opts.action,
    profile_id: opts.profileId ?? null,
    email_hash: email ? hashEmail(email) : null,
    email_masked: email ? maskEmail(email) : null,
    actor_profile_id: opts.actorProfileId ?? null,
    meta: opts.meta ?? {},
  })

  if (error) {
    console.error("[login-lockout] audit_insert_failed", {
      action: opts.action,
      message: error.message.slice(0, 120),
    })
  }
}

export type LockedProfileListItem = {
  profileId: string
  displayName: string
  emailMasked: string
  organizationId: string | null
  lockoutUntil: string
  failedLoginAttempts: number
}

/**
 * ロック中のプロファイル一覧（同一事業所 or 運営は全件）。
 * メールは auth.users から取得してマスクする。
 */
export async function listLockedProfiles(opts: {
  actorProfileId: string
  actorOrganizationId: string | null
  isOperator: boolean
  isOrgAdmin: boolean
}): Promise<LockedProfileListItem[]> {
  if (!opts.isOperator && !opts.isOrgAdmin) return []

  const service = createServiceClient()
  const nowIso = new Date().toISOString()

  let query = service
    .from("profiles")
    .select("id, display_name, organization_id, lockout_until, failed_login_attempts")
    .not("lockout_until", "is", null)
    .gt("lockout_until", nowIso)
    .is("deleted_at", null)

  if (!opts.isOperator) {
    if (!opts.actorOrganizationId) return []
    query = query.eq("organization_id", opts.actorOrganizationId)
  }

  const { data, error } = await query.order("lockout_until", {
    ascending: true,
  })

  if (error || !data) {
    console.error("[login-lockout] list_locked_failed", {
      message: error?.message?.slice(0, 120),
    })
    return []
  }

  const items: LockedProfileListItem[] = []
  for (const row of data) {
    const emailMasked = await resolveMaskedEmail(service, row.id as string)
    items.push({
      profileId: row.id as string,
      displayName: (row.display_name as string) || "（氏名なし）",
      emailMasked,
      organizationId: (row.organization_id as string | null) ?? null,
      lockoutUntil: row.lockout_until as string,
      failedLoginAttempts: Number(row.failed_login_attempts ?? 0),
    })
  }
  return items
}

async function resolveMaskedEmail(
  service: ServiceClient,
  userId: string
): Promise<string> {
  const { data, error } = await service.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return "***"
  return maskEmail(data.user.email)
}

/**
 * 手動解除。運営は誰でも可。事業所 admin は同一 organization のみ。
 */
export async function unlockLoginForProfile(opts: {
  targetProfileId: string
  actorProfileId: string
  actorOrganizationId: string | null
  isOperator: boolean
  isOrgAdmin: boolean
}): Promise<{ ok: true } | { ok: false; error: string; status: 403 | 404 | 500 }> {
  if (!opts.isOperator && !opts.isOrgAdmin) {
    return {
      ok: false,
      error: "ロック解除の権限がありません。",
      status: 403,
    }
  }

  const service = createServiceClient()
  const { data: target, error } = await service
    .from("profiles")
    .select("id, organization_id, deleted_at")
    .eq("id", opts.targetProfileId)
    .maybeSingle()

  if (error || !target || target.deleted_at) {
    return { ok: false, error: "対象ユーザーが見つかりません。", status: 404 }
  }

  if (!opts.isOperator) {
    if (
      !opts.actorOrganizationId ||
      target.organization_id !== opts.actorOrganizationId
    ) {
      return {
        ok: false,
        error: "他事業所のユーザーは解除できません。",
        status: 403,
      }
    }
  }

  try {
    await clearLoginLockout(opts.targetProfileId, service)
    const emailMasked = await resolveMaskedEmail(service, opts.targetProfileId)
    await writeAuthAuditLog({
      action: "login_unlock",
      profileId: opts.targetProfileId,
      actorProfileId: opts.actorProfileId,
      meta: {
        email_masked: emailMasked,
        by: opts.isOperator ? "operator" : "org_admin",
      },
      service,
    })
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: "ロック解除に失敗しました。",
      status: 500,
    }
  }
}
