import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type SectionCardProps = {
  icon: LucideIcon
  title: string
  description?: string
  badge?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  id?: string
}

/**
 * 設定画面と同型の白枠カテゴリ。
 * 1行目: アイコン＋名称（＋任意バッジ／アクション）
 * 改行: 短い補足 → 本体
 */
export function SectionCard({
  icon: Icon,
  title,
  description,
  badge,
  action,
  children,
  className,
  contentClassName,
  id,
}: SectionCardProps) {
  return (
    <Card id={id} className={cn("rounded-lg shadow-subtle", className)}>
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-lg">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">{title}</span>
            {badge}
          </CardTitle>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {description ? (
          <CardDescription className="text-base leading-relaxed">
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
    </Card>
  )
}
