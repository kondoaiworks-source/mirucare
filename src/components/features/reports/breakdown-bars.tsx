import type { SeverityBreakdownItem } from "@/lib/reports"
import { cn } from "@/lib/utils"

type BreakdownBarsProps = {
  items: SeverityBreakdownItem[]
  className?: string
}

const BAR_COLORS: Record<string, string> = {
  high: "bg-danger",
  mid: "bg-warning",
  low: "bg-primary",
}

export function BreakdownBars({ items, className }: BreakdownBarsProps) {
  if (items.length === 0) {
    return (
      <p className="text-base leading-relaxed text-muted-foreground">
        この月の指摘データはまだありません。
      </p>
    )
  }

  const max = Math.max(...items.map((i) => i.count), 1)

  return (
    <ul className={cn("space-y-4", className)} aria-label="指摘の内訳">
      {items.map((item) => {
        const pct = Math.round((item.count / max) * 100)
        return (
          <li key={item.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-base font-medium text-foreground">
                {item.label}
              </span>
              <span className="text-xl font-bold tabular-nums text-primary-dark">
                {item.count}
                <span className="ml-0.5 text-sm font-normal text-muted-foreground">
                  件
                </span>
              </span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-lg bg-muted"
              role="img"
              aria-label={`${item.label} ${item.count}件`}
            >
              <div
                className={cn(
                  "h-full rounded-lg transition-[width] duration-300",
                  BAR_COLORS[item.key] ?? "bg-primary"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
