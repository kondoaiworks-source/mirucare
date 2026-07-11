import { AppShell } from "@/components/features/layout/app-shell"
import { UploadProvider } from "@/components/features/documents/upload-provider"
import { getCurrentProfile } from "@/app/actions/auth"
import { countLaterFindingsAction } from "@/app/actions/findings"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let facilityName: string | undefined
  let laterCount = 0

  try {
    const profile = await getCurrentProfile()
    const org = Array.isArray(profile?.organizations)
      ? profile?.organizations[0]
      : profile?.organizations
    facilityName = org?.name

    const later = await countLaterFindingsAction()
    if (later.ok && later.data) {
      laterCount = later.data.count
    }
  } catch {
    // Supabase 未設定時はデモ名を表示
  }

  return (
    <UploadProvider>
      <AppShell facilityName={facilityName} laterCount={laterCount}>
        {children}
      </AppShell>
    </UploadProvider>
  )
}
