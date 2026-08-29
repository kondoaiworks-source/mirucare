"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, isNavItemActive } from "./nav-items"

export function Sidebar({
  laterCount = 0,
  incompleteDocumentsCount = 0,
  announcementCount = 0,
}: {
  laterCount?: number
  incompleteDocumentsCount?: number
  announcementCount?: number
}) {
  const pathname = usePathname()

  return (
    <aside
      className="no-print hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex"
      aria-label="メインメニュー"
    >
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <Link
          href="/"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
            aria-hidden
          >
            監
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight text-primary-dark">
              監査のミカタ
            </p>
            <p className="text-xs text-muted-foreground">AI書類Wチェック</p>
          </div>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = isNavItemActive(pathname, item.href)
          const showHomeBadge = item.href === "/" && announcementCount > 0
          const showLaterBadge = item.href === "/later" && laterCount > 0
          const showDocsBadge =
            item.href === "/audit-history" && incompleteDocumentsCount > 0
          const badgeCount = showHomeBadge
            ? announcementCount
            : showLaterBadge
              ? laterCount
              : showDocsBadge
                ? incompleteDocumentsCount
                : 0
          const showBadge = showHomeBadge || showLaterBadge || showDocsBadge

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={showBadge ? `${item.label}（${badgeCount}件）` : undefined}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="flex-1 leading-snug">{item.label}</span>
              {showBadge ? (
                <span
                  className={cn(
                    "inline-flex min-h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-xs font-bold tabular-nums",
                    showLaterBadge
                      ? "bg-warning text-warning-foreground"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
