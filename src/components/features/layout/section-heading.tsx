import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * セクション見出し（設定画面など）。
 * 小さめ・大文字間隔・muted + primary アイコン
 */
export function SectionHeading({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        "flex items-center gap-2 text-sm font-bold tracking-wide text-muted-foreground",
        className
      )}
    >
      <Icon className="size-4 shrink-0 text-primary" aria-hidden />
      {children}
    </h2>
  )
}

/**
 * カードタイトル（アイコン付き）。
 * size-9 の primary/10 背景 + size-5 アイコン + text-lg
 */
export function CardTitleWithIcon({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <CardTitle
      className={cn("flex items-center gap-2 text-lg", className)}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      {children}
    </CardTitle>
  )
}
