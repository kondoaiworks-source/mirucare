import { Sidebar } from "./sidebar"
import { MobileTabBar } from "./mobile-tab-bar"
import { AppHeader } from "./app-header"
import { AppFooter } from "./app-footer"

type AppShellProps = {
  children: React.ReactNode
  facilityName?: string
  laterCount?: number
  incompleteDocumentsCount?: number
}

export function AppShell({
  children,
  facilityName,
  laterCount = 0,
  incompleteDocumentsCount = 0,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar
        laterCount={laterCount}
        incompleteDocumentsCount={incompleteDocumentsCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader facilityName={facilityName} />
        <main className="flex-1 overflow-y-auto bg-surface px-4 py-6 pb-24 md:px-8 md:pb-8 print:bg-white print:p-0 print:pb-0">
          {children}
        </main>
        <div className="no-print pb-16 md:pb-0">
          <AppFooter />
        </div>
      </div>
      <MobileTabBar
        laterCount={laterCount}
        incompleteDocumentsCount={incompleteDocumentsCount}
      />
    </div>
  )
}
