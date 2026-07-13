"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "./nav-items"

export function MobileTabBar({
  laterCount = 0,
  incompleteDocumentsCount = 0,
}: {
  laterCount?: number
  incompleteDocumentsCount?: number
}) {
  const pathname = usePathname()

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden"
      aria-label="モバイルメニュー"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex w-full min-w-0 gap-0.5 px-1 pt-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/documents"
                ? pathname.startsWith("/documents") ||
                  pathname.startsWith("/check")
                : item.href === "/reconcile"
                  ? pathname.startsWith("/reconcile") ||
                    pathname.startsWith("/attendance") ||
                    pathname.startsWith("/billing-reconcile")
                  : pathname.startsWith(item.href)
          const showLaterBadge = item.href === "/later" && laterCount > 0
          const showDocsBadge =
            item.href === "/documents" && incompleteDocumentsCount > 0
          const badgeCount = showLaterBadge
            ? laterCount
            : showDocsBadge
              ? incompleteDocumentsCount
              : 0
          const showBadge = showLaterBadge || showDocsBadge

          return (
            <li key={item.href} className="min-w-0 flex-1 basis-0">
              <Link
                href={item.href}
                className={cn(
                  "relative flex min-h-14 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isActive
                    ? "bg-primary/15 font-bold text-primary"
                    : "font-medium text-muted-foreground hover:bg-muted/60"
                )}
                aria-current={isActive ? "page" : undefined}
                aria-label={
                  showBadge ? `${item.label}（${badgeCount}件）` : item.label
                }
              >
                {/* 選択中の目印（上の線） */}
                {isActive ? (
                  <span
                    className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary"
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    "relative inline-flex rounded-md p-1",
                    isActive && "bg-primary/10"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-5 shrink-0",
                      isActive && "stroke-[2.25]"
                    )}
                    aria-hidden
                  />
                  {showBadge ? (
                    <span
                      className={cn(
                        "absolute -right-2 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums leading-none",
                        showLaterBadge
                          ? "bg-warning text-warning-foreground"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  ) : null}
                </span>
                <span className="w-full truncate text-center leading-tight">
                  {item.shortLabel}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
