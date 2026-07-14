import { cache } from "react"
import { getCurrentProfile } from "@/app/actions/auth"
import { countLaterFindingsAction } from "@/app/actions/findings"
import { countIncompleteDocumentsAction } from "@/app/actions/documents"

export type AppShellData = {
  facilityName: string | undefined
  laterCount: number
  incompleteDocumentsCount: number
}

/**
 * 同一リクエスト内で Sidebar / Header / MobileTabBar から呼ばれても
 * 1回だけフェッチする（React cache）。
 */
export const getAppShellData = cache(async (): Promise<AppShellData> => {
  let facilityName: string | undefined
  let laterCount = 0
  let incompleteDocumentsCount = 0

  try {
    const profile = await getCurrentProfile()
    const org = Array.isArray(profile?.organizations)
      ? profile?.organizations[0]
      : profile?.organizations
    facilityName = org?.name

    const [later, incomplete] = await Promise.all([
      countLaterFindingsAction(),
      countIncompleteDocumentsAction(),
    ])
    if (later.ok && later.data) {
      laterCount = later.data.count
    }
    if (incomplete.ok && incomplete.data) {
      incompleteDocumentsCount = incomplete.data.count
    }
  } catch {
    // Supabase 未設定時などはバッジなしでシェルを表示
  }

  return { facilityName, laterCount, incompleteDocumentsCount }
})
