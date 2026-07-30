import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"

export type BreadcrumbItem = {
  label: string
  href?: string
}

type AdminBreadcrumbProps = {
  items: BreadcrumbItem[]
  /** ルート（省略時は介護サービス選定） */
  homeHref?: string
  homeLabel?: string
}

/**
 * 管理画面用パンくず。最終項目は現在地（リンクなし）。
 */
export function AdminBreadcrumb({
  items,
  homeHref = "/admin/rules/services",
  homeLabel = "介護サービス選定",
}: AdminBreadcrumbProps) {
  return (
    <nav aria-label="パンくず" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <li className="inline-flex items-center">
          <Link
            href={homeHref}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Home className="size-3.5" aria-hidden />
            {homeLabel}
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.label} className="inline-flex items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 items-center rounded-lg px-1.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center px-1.5 font-medium text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
