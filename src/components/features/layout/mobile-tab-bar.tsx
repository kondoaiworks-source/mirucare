"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "./nav-items"

export function MobileTabBar({ laterCount = 0 }: { laterCount?: number }) {
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
                : pathname.startsWith(item.href)
          const showLaterBadge = item.href === "/later" && laterCount > 0

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
                  showLaterBadge
                    ? `${item.label}（${laterCount}件）`
                    : undefined
                }
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden />
                  {showLaterBadge ? (
                    <span className="absolute -right-2.5 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold tabular-nums leading-none text-warning-foreground">
                      {laterCount > 99 ? "99+" : laterCount}
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
