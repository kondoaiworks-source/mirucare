"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { countUnreadAnnouncements } from "@/lib/announcements-unread"
import { toUserErrorMessage } from "@/lib/auth-errors"
import type { AppAnnouncement } from "@/types/database"

export type ActionResult<T = undefined> = {
  ok: boolean
  error?: string
  data?: T
}

async function requireOrgContext() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error:
        "ログインの有効期限が切れた可能性があります。再度ログインしてください。",
    } as const
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return { error: "事業所情報が取得できませんでした。" } as const
  }

  return {
    supabase,
    user,
    organizationId: profile.organization_id as string,
    role: profile.role as string,
  }
}

export async function listAnnouncementsAction(
  limit = 50
): Promise<ActionResult<{ announcements: AppAnnouncement[]; canPost: boolean }>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { data, error } = await ctx.supabase
    .from("app_announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return {
      ok: false,
      error: toUserErrorMessage(error, "お知らせを取得できませんでした。"),
    }
  }

  return {
    ok: true,
    data: {
      announcements: (data ?? []) as AppAnnouncement[],
      canPost: ctx.role === "admin",
    },
  }
}

export async function createFacilityAnnouncementAction(input: {
  title: string
  body: string
}): Promise<ActionResult<{ announcement: AppAnnouncement }>> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  if (ctx.role !== "admin") {
    return { ok: false, error: "お知らせの投稿は管理者のみ行えます。" }
  }

  const title = input.title.trim()
  const body = input.body.trim()
  if (title.length < 2) {
    return { ok: false, error: "タイトルを入力してください。" }
  }
  if (body.length < 2) {
    return { ok: false, error: "本文を入力してください。" }
  }

  const { data, error } = await ctx.supabase
    .from("app_announcements")
    .insert({
      title,
      body,
      kind: "general",
      organization_id: ctx.organizationId,
      created_by: ctx.user.id,
    })
    .select("*")
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: toUserErrorMessage(error, "お知らせの投稿に失敗しました。"),
    }
  }

  revalidatePath("/")
  revalidatePath("/announcements")
  await ctx.supabase
    .from("profiles")
    .update({ announcements_seen_at: new Date().toISOString() })
    .eq("id", ctx.user.id)
  revalidatePath("/", "layout")
  return { ok: true, data: { announcement: data as AppAnnouncement } }
}

/** お知らせ一覧を開いたときに既読にする（バッジ用） */
export async function markAnnouncementsSeenAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ announcements_seen_at: new Date().toISOString() })
    .eq("id", ctx.user.id)

  if (error) {
    return {
      ok: false,
      error: toUserErrorMessage(error, "既読の更新に失敗しました。"),
    }
  }

  revalidatePath("/", "layout")
  revalidatePath("/announcements")
  return { ok: true }
}

export async function countUnreadAnnouncementsAction(): Promise<
  ActionResult<{ count: number }>
> {
  const ctx = await requireOrgContext()
  if ("error" in ctx) return { ok: false, error: ctx.error }

  const count = await countUnreadAnnouncements(ctx.supabase, ctx.user.id)
  return { ok: true, data: { count } }
}
