import { AppShell } from "@/components/features/layout/app-shell"
import { UploadProvider } from "@/components/features/documents/upload-provider"
import { getCurrentProfile } from "@/app/actions/auth"
import { countLaterFindingsAction } from "@/app/actions/findings"
import { countIncompleteDocumentsAction } from "@/app/actions/documents"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
    // Supabase 未設定時はデモ名を表示
  }

  return (
    <UploadProvider>
      <AppShell
        facilityName={facilityName}
        laterCount={laterCount}
        incompleteDocumentsCount={incompleteDocumentsCount}
      >
        {children}
      </AppShell>
    </UploadProvider>
  )
}
