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
      <ul className="flex">
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
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
                aria-label={
                  showBadge ? `${item.label}（${badgeCount}件）` : undefined
                }
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden />
                  {showBadge ? (
                    <span
                      className={cn(
                        "absolute -right-2.5 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums leading-none",
                        showLaterBadge
                          ? "bg-warning text-warning-foreground"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{item.shortLabel}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
