import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description?: string
  /** 右側の主要アクション（アップロード等） */
  action?: ReactNode
  className?: string
}

/**
 * 画面表題の共通部品。
 * h1: 2xl / md:3xl・primary-dark・太字
 * 補足: 16px・行間ゆったり・muted
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  )
}
