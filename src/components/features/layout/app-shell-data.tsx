import { getAppShellData } from "@/lib/app-shell-data"
import { AppHeader } from "./app-header"
import { MobileTabBar } from "./mobile-tab-bar"
import { Sidebar } from "./sidebar"

export async function SidebarWithData() {
  const { laterCount, incompleteDocumentsCount } = await getAppShellData()
  return (
    <Sidebar
      laterCount={laterCount}
      incompleteDocumentsCount={incompleteDocumentsCount}
    />
  )
}

export async function AppHeaderWithData() {
  const { facilityName } = await getAppShellData()
  return <AppHeader facilityName={facilityName} />
}

export async function MobileTabBarWithData() {
  const { laterCount, incompleteDocumentsCount } = await getAppShellData()
  return (
    <MobileTabBar
      laterCount={laterCount}
      incompleteDocumentsCount={incompleteDocumentsCount}
    />
  )
}
