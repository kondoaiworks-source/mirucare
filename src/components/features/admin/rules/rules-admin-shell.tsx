"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  RULES_ADMIN_NAV_GROUPS,
  isNavItemActive,
} from "@/lib/rule-engine/nav"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function RulesAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="lg:w-64 lg:shrink-0">
        <div className="space-y-1">
          <p className="px-2 text-sm font-semibold text-primary-dark">
            ルール設定
          </p>
        </div>

        <nav
          aria-label="ルール設定メニュー"
          className="-mx-1 flex gap-1 overflow-x-auto pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {RULES_ADMIN_NAV_GROUPS.map((group) => (
            <div
              key={group.id}
              className="flex shrink-0 gap-1 lg:mb-4 lg:flex-col lg:gap-0.5"
            >
              {group.label ? (
                <p className="hidden px-2 pb-1.5 pt-1 text-xs font-semibold tracking-wide text-muted-foreground lg:block">
                  {group.label}
                </p>
              ) : null}
              {group.items.map((item) => {
                const active = isNavItemActive(pathname, item)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.description}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-base transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-primary/10 font-semibold text-primary-dark"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="mt-4 hidden flex-col gap-2 lg:flex">
          <Button asChild variant="outline" size="sm" className="justify-start">
            <Link href="/settings">設定へ戻る</Link>
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-6">{children}</div>
    </div>
  )
}
