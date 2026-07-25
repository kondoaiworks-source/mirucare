import { Suspense } from "react"
import {
  AppHeaderWithData,
  MobileTabBarWithData,
  SidebarWithData,
} from "./app-shell-data"
import { AppHeader } from "./app-header"
import { AppFooter } from "./app-footer"
import { MobileTabBar } from "./mobile-tab-bar"
import { Sidebar } from "./sidebar"

type AppShellProps = {
  children: React.ReactNode
}

/**
 * シェル自体は同期描画。バッジ・事業所名だけ Suspense で遅延取得し、
 * ページ遷移時に children をデータ待ちでブロックしない。
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh bg-background">
      <Suspense fallback={<Sidebar />}>
        <SidebarWithData />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<AppHeader />}>
          <AppHeaderWithData />
        </Suspense>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-surface px-4 py-6 pb-28 md:px-8 md:pb-8 print:bg-white print:p-0 print:pb-0">
          {children}
        </main>
        <div className="no-print pb-24 md:pb-0">
          <AppFooter />
        </div>
      </div>
      <Suspense fallback={<MobileTabBar />}>
        <MobileTabBarWithData />
      </Suspense>
    </div>
  )
}
