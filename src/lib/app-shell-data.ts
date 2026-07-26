import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/app/actions/auth"
import { countLaterFindingsAction } from "@/app/actions/findings"
import { countIncompleteDocumentsAction } from "@/app/actions/documents"

export type AppShellData = {
  facilityName: string | undefined
  displayName: string | undefined
  laterCount: number
  incompleteDocumentsCount: number
  announcementCount: number
}

/**
 * 同一リクエスト内で Sidebar / Header / MobileTabBar から呼ばれても
 * 1回だけフェッチする（React cache）。
 */
export const getAppShellData = cache(async (): Promise<AppShellData> => {
  let facilityName: string | undefined
  let displayName: string | undefined
  let laterCount = 0
  let incompleteDocumentsCount = 0
  let announcementCount = 0

  try {
    const profile = await getCurrentProfile()
    const org = Array.isArray(profile?.organizations)
      ? profile?.organizations[0]
      : profile?.organizations
    facilityName = org?.name
    displayName = profile?.display_name?.trim() || undefined

    const [later, incomplete, announcements] = await Promise.all([
      countLaterFindingsAction(),
      countIncompleteDocumentsAction(),
      createClient()
        .from("app_announcements")
        .select("id", { count: "exact", head: true }),
    ])
    if (later.ok && later.data) {
      laterCount = later.data.count
    }
    if (incomplete.ok && incomplete.data) {
      incompleteDocumentsCount = incomplete.data.count
    }
    if (!announcements.error) {
      announcementCount = announcements.count ?? 0
    }
  } catch {
    // Supabase 未設定時などはバッジなしでシェルを表示
  }

  return {
    facilityName,
    displayName,
    laterCount,
    incompleteDocumentsCount,
    announcementCount,
  }
})
