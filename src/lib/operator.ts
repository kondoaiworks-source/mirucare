import { createClient, createServiceClient } from "@/lib/supabase/server"

export type OperatorContext = {
  supabase: ReturnType<typeof createClient>
  service: ReturnType<typeof createServiceClient>
  userId: string
  email: string | null
}

function operatorEmailsFromEnv(): Set<string> {
  const raw = process.env.OPERATOR_EMAILS ?? ""
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

/**
 * 運営アカウント判定：profiles.is_operator または OPERATOR_EMAILS
 */
export async function requireOperator(): Promise<
  OperatorContext | { error: string }
> {
  const auth = await resolveOperatorAuth()
  if ("error" in auth) return auth

  let service: ReturnType<typeof createServiceClient>
  try {
    service = createServiceClient()
  } catch {
    return {
      error:
        "サービスロールキーが未設定です。SUPABASE_SERVICE_ROLE_KEY を確認してください。",
    }
  }

  return {
    supabase: auth.supabase,
    service,
    userId: auth.userId,
    email: auth.email,
  }
}

async function resolveOperatorAuth(): Promise<
  | {
      supabase: ReturnType<typeof createClient>
      userId: string
      email: string | null
    }
  | { error: string }
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error:
        "ログインの有効期限が切れた可能性があります。再度ログインしてください。",
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_operator, deleted_at")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || profile.deleted_at) {
    return { error: "プロフィールを取得できませんでした。" }
  }

  const email = user.email?.toLowerCase() ?? null
  const allowlist = operatorEmailsFromEnv()
  const isOperator =
    profile.is_operator === true ||
    (email != null && allowlist.has(email))

  if (!isOperator) {
    return {
      error: "この画面は運営アカウントのみ利用できます。",
    }
  }

  return { supabase, userId: user.id, email }
}

export async function isCurrentUserOperator(): Promise<boolean> {
  const result = await resolveOperatorAuth()
  return !("error" in result)
}
