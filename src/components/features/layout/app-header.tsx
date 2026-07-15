import { Building2 } from "lucide-react"
import { DEMO_FACILITY_NAME } from "./nav-items"
import { HeaderMenu } from "./header-menu"

type AppHeaderProps = {
  facilityName?: string
}

export function AppHeader({
  facilityName = DEMO_FACILITY_NAME,
}: AppHeaderProps) {
  return (
    <header className="no-print flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 md:h-16 md:gap-3 md:px-6">
      <div className="min-w-0 shrink-0 md:hidden">
        <p className="truncate text-base font-bold text-primary-dark">
          監査のミカタ
        </p>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="flex min-h-11 min-w-0 max-w-[46vw] items-center gap-2 rounded-lg bg-surface px-2.5 py-2 sm:max-w-xs md:max-w-none md:px-3">
          <Building2 className="size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 text-right">
            <p className="text-xs text-muted-foreground">ログイン中の事業所</p>
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {facilityName}
            </p>
          </div>
        </div>
        <HeaderMenu />
      </div>
    </header>
  )
}
