"use client"

import { cn } from "@/lib/utils"

const SERVICES = [
  {
    value: "訪問介護",
    label: "訪問介護",
    description: "Phase1で利用できます",
    available: true,
  },
  {
    value: "通所介護",
    label: "通所介護（デイサービス）",
    description: "準備中です",
    available: false,
  },
  {
    value: "その他",
    label: "その他",
    description: "準備中です",
    available: false,
  },
] as const

type Props = {
  /** 見出しを出すか */
  showHeading?: boolean
  className?: string
}

/**
 * ルールブックのサービス選択。Phase1は訪問介護のみ選択可。
 */
export function RulebookServiceSelect({
  showHeading = true,
  className,
}: Props) {
  return (
    <section className={cn("space-y-3", className)} aria-labelledby="service-select-heading">
      {showHeading ? (
        <div>
          <h2
            id="service-select-heading"
            className="text-lg font-bold text-primary-dark"
          >
            サービス選択
          </h2>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            いまは訪問介護のルールブックだけ使えます。ほかのサービスは準備中です。
          </p>
        </div>
      ) : (
        <h2 id="service-select-heading" className="sr-only">
          サービス選択
        </h2>
      )}
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="サービス種別">
        {SERVICES.map((s) => (
          <div
            key={s.value}
            role="radio"
            aria-checked={s.available}
            aria-disabled={!s.available}
            tabIndex={s.available ? 0 : -1}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-colors",
              s.available
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-muted/40 opacity-70"
            )}
          >
            <p className="text-base font-semibold text-primary-dark">{s.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {s.description}
            </p>
            {s.available ? (
              <p className="mt-2 text-sm font-medium text-primary">選択中</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">選べません</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
