import { getAppShellData } from "@/lib/app-shell-data"
import { AppHeader } from "./app-header"
import { MobileTabBar } from "./mobile-tab-bar"
import { Sidebar } from "./sidebar"

export async function SidebarWithData() {
  const { laterCount, incompleteDocumentsCount, announcementCount } =
    await getAppShellData()
  return (
    <Sidebar
      laterCount={laterCount}
      incompleteDocumentsCount={incompleteDocumentsCount}
      announcementCount={announcementCount}
    />
  )
}

export async function AppHeaderWithData() {
  const { facilityName } = await getAppShellData()
  return <AppHeader facilityName={facilityName} />
}

export async function MobileTabBarWithData() {
  const { laterCount, incompleteDocumentsCount, announcementCount } =
    await getAppShellData()
  return (
    <MobileTabBar
      laterCount={laterCount}
      incompleteDocumentsCount={incompleteDocumentsCount}
      announcementCount={announcementCount}
    />
  )
}
