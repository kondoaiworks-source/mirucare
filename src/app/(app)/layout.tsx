import { UploadProvider } from "@/components/features/documents/upload-provider"
import { AppShell } from "@/components/features/layout/app-shell"

/**
 * レイアウトは同期。ナビバッジ等の重い取得は AppShell 内の Suspense に分離し、
 * 画面遷移をデータ待ちでブロックしない。
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UploadProvider>
      <AppShell>{children}</AppShell>
    </UploadProvider>
  )
}
