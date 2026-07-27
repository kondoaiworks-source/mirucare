import Link from "next/link"
import { Building2, UserRound } from "lucide-react"
import { DEMO_FACILITY_NAME } from "./nav-items"
import { HeaderMenu } from "./header-menu"

type AppHeaderProps = {
  facilityName?: string
  displayName?: string
}

export function AppHeader({
  facilityName = DEMO_FACILITY_NAME,
  displayName,
}: AppHeaderProps) {
  return (
    <header className="no-print flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 md:h-16 md:gap-3 md:px-6">
      <Link
        href="/"
        className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
          aria-hidden
        >
          監
        </span>
        <p className="truncate text-base font-bold text-primary-dark">
          監査のミカタ
        </p>
      </Link>

      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="flex min-h-11 min-w-0 max-w-[52vw] items-center gap-2 rounded-lg bg-surface px-2.5 py-2 sm:max-w-sm md:max-w-none md:px-3">
          <Building2 className="size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 text-right">
            <p className="text-xs text-muted-foreground">ログイン中の事業所</p>
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {facilityName}
            </p>
            {displayName ? (
              <p className="mt-0.5 flex items-center justify-end gap-1 truncate text-xs text-muted-foreground">
                <UserRound className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{displayName}</span>
              </p>
            ) : null}
          </div>
        </div>
        <HeaderMenu />
      </div>
    </header>
  )
}
