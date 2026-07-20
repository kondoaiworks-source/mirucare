"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { RULES_ADMIN_NAV } from "@/lib/rule-engine/nav"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function RulesAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="lg:w-60 lg:shrink-0">
        <div className="space-y-1">
          <p className="px-2 text-sm font-semibold text-primary-dark">
            ルールエンジン管理
          </p>
          <p className="px-2 pb-3 text-sm leading-relaxed text-muted-foreground">
            法令・自治体・監査項目・AI判定のマスタ（運営のみ）
          </p>
        </div>

        {/* スマホ: 横スクロール */}
        <nav
          aria-label="ルールエンジンメニュー"
          className="-mx-1 flex gap-1 overflow-x-auto pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {RULES_ADMIN_NAV.map((item) => {
            const active =
              item.href === "/admin/rules"
                ? pathname === "/admin/rules"
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-base transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary/10 font-semibold text-primary-dark"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-4 hidden flex-col gap-2 lg:flex">
          <Button asChild variant="outline" size="sm" className="justify-start">
            <Link href="/admin/documents">行政マニュアル管理へ</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="justify-start">
            <Link href="/admin/document-changes">マニュアル変更の承認へ</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="justify-start">
            <Link href="/settings">設定へ戻る</Link>
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-6">{children}</div>
    </div>
  )
}
