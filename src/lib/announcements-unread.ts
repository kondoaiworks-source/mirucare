import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * ユーザーがまだ一覧で見ていないお知らせ件数。
 * announcements_seen_at 未設定時は全件を未読として数える。
 */
export async function countUnreadAnnouncements(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("announcements_seen_at")
    .eq("id", userId)
    .maybeSingle()

  let query = supabase
    .from("app_announcements")
    .select("id", { count: "exact", head: true })

  if (profile?.announcements_seen_at) {
    query = query.gt("created_at", profile.announcements_seen_at)
  }

  const { count, error } = await query
  if (error) return 0
  return count ?? 0
}
