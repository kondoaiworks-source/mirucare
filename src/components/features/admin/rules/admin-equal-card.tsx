import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight, type LucideIcon } from "lucide-react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Props = {
  href?: string
  title: string
  /** 省略可。ハブでは説明を置かず見出しだけで進める */
  description?: string
  icon?: LucideIcon
  badge?: ReactNode
  className?: string
  /** メトリクス用の大きな数字 */
  value?: string | number
  onClick?: () => void
}

/**
 * ハブ用の等寸カード。1作業1リンク。説明は最小限。
 */
export function AdminEqualCard({
  href,
  title,
  description,
  icon: Icon,
  badge,
  className,
  value,
  onClick,
}: Props) {
  const inner = (
    <Card
      className={cn(
        "h-full min-h-[7.5rem] rounded-xl shadow-subtle transition-colors",
        (href || onClick) &&
          "group-hover:border-primary/30 group-hover:bg-primary/[0.02]",
        className
      )}
    >
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          {Icon ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
          ) : (
            <span className="size-10 shrink-0" aria-hidden />
          )}
          <div className="flex items-center gap-2">
            {badge}
            {href || onClick ? (
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                aria-hidden
              />
            ) : null}
          </div>
        </div>
        {value != null ? (
          <p className="text-3xl font-bold tabular-nums text-primary-dark">
            {value}
          </p>
        ) : null}
        <CardTitle className="line-clamp-1 text-lg text-primary-dark">
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="line-clamp-2 text-base leading-relaxed">
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
    </Card>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {inner}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group block h-full w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {inner}
      </button>
    )
  }

  return <div className="h-full">{inner}</div>
}
