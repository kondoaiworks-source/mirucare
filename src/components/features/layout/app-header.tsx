import { Building2 } from "lucide-react"
import { DEMO_FACILITY_NAME } from "./nav-items"

type AppHeaderProps = {
  facilityName?: string
}

export function AppHeader({
  facilityName = DEMO_FACILITY_NAME,
}: AppHeaderProps) {
  return (
    <header className="no-print flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:h-16 md:px-6">
      <div className="md:hidden">
        <p className="text-base font-bold text-primary-dark">監査のミカタ</p>
      </div>
      <div className="ml-auto flex min-h-11 items-center gap-2 rounded-lg bg-surface px-3 py-2">
        <Building2 className="size-4 text-primary" aria-hidden />
        <div className="text-right">
          <p className="text-xs text-muted-foreground">ログイン中の事業所</p>
          <p className="text-sm font-semibold leading-tight text-foreground">
            {facilityName}
          </p>
        </div>
      </div>
    </header>
  )
}
