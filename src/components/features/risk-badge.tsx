import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  AlertCircle,
  Info,
  type LucideIcon,
} from "lucide-react"

export type RiskLevel = "high" | "medium" | "low"

const riskConfig: Record<
  RiskLevel,
  {
    label: string
    description: string
    icon: LucideIcon
    className: string
  }
> = {
  high: {
    label: "緊急",
    description: "返還・行政指導につながりやすい不備の可能性があります",
    icon: AlertCircle,
    className: "bg-danger/10 text-danger border-danger/30",
  },
  medium: {
    label: "要改善",
    description: "監査で指摘される可能性が高い事項です",
    icon: AlertTriangle,
    className: "bg-warning/10 text-warning border-warning/30",
  },
  low: {
    label: "推奨",
    description: "運営品質向上のための改善提案です",
    icon: Info,
    className: "bg-muted text-muted-foreground border-border",
  },
}

type RiskBadgeProps = {
  level: RiskLevel
  className?: string
  showDescription?: boolean
}

/**
 * リスク表示は色だけに頼らず、必ずアイコン＋テキストラベルを併記
 */
export function RiskBadge({
  level,
  className,
  showDescription = false,
}: RiskBadgeProps) {
  const config = riskConfig[level]
  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium",
        config.className,
        className
      )}
      role="status"
      aria-label={`${config.label}：${config.description}`}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{config.label}</span>
      {showDescription ? (
        <span className="font-normal opacity-80">（{config.description}）</span>
      ) : null}
    </span>
  )
}
